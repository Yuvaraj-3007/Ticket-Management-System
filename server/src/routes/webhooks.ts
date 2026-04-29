import { Router } from "express";
import { randomUUID, timingSafeEqual } from "node:crypto";
import multer from "multer";
import { inboundEmailSchema, TICKET_TYPE, PRIORITY, STATUS, ROLES } from "@tms/core";
import prisma from "../lib/prisma.js";
import boss from "../lib/boss.js";
import { CLASSIFY_QUEUE, type ClassifyJobData } from "../workers/classify.js";
import { AUTO_RESOLVE_QUEUE, type AutoResolveJobData } from "../workers/auto-resolve.js";
import { fetchEmailById, isGmailApiConfigured, listUnprocessedMessages, markAsRead, isCurrentlyDraining } from "../lib/gmail.js";
import type { EmailData } from "../lib/imap.js";

const router = Router();
// Parses multipart/form-data (used by Cloudmailin's Multipart Normalized format)
const multipartParser = multer();

// Shared ticket-creation logic used by both webhook endpoints
async function createTicketFromEmail(
  from: string,
  name: string | undefined,
  subject: string,
  body: string,
  project?: string,
  hrmsClientId?: string,
): Promise<{ ticket: { id: string; ticketId: string }; admin: { id: string }; from: string; name: string | undefined; subject: string; body: string }> {
  const [admin, aiAgent] = await Promise.all([
    prisma.user.findFirst({ where: { role: ROLES.ADMIN } }),
    prisma.user.findUnique({ where: { email: "ai@system.internal" } }),
  ]);
  if (!admin) throw new Error("No admin user found");

  const ticket = await prisma.$transaction(async (tx) => {
    const latest = await tx.ticket.findFirst({
      orderBy: { ticketId: "desc" },
      select: { ticketId: true },
    });

    let nextNumber = 1;
    if (latest) {
      const match = latest.ticketId.match(/^TKT-(\d+)$/);
      if (match) nextNumber = parseInt(match[1], 10) + 1;
    }

    const ticketId = `TKT-${String(nextNumber).padStart(4, "0")}`;
    // M-1 — strip CRLF from name to prevent header injection if description is used in email context
    const safeName    = name ? name.replace(/[\r\n]/g, " ") : undefined;
    const description = safeName
      ? `From: ${safeName} <${from}>\n\n${body}`
      : `From: ${from}\n\n${body}`;

    return tx.ticket.create({
      data: {
        id:          randomUUID(),
        ticketId,
        title:       subject,
        description,
        type:        TICKET_TYPE.SUPPORT,
        priority:    PRIORITY.MEDIUM,
        status:      STATUS.UN_ASSIGNED,
        project:      project ?? "General",
        hrmsClientId: hrmsClientId ?? null,
        senderName:   name ?? null,
        senderEmail:  from,
        createdById:  admin.id,
        assignedToId: aiAgent?.id ?? null,
      },
      select: { id: true, ticketId: true },
    });
  });

  return { ticket, admin, from, name, subject, body };
}

// POST /api/webhooks/email
// Accepts a simulated inbound email payload and creates a ticket.
router.post("/email", async (req, res) => {
  const result = inboundEmailSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ fieldErrors: result.error.flatten().fieldErrors });
    return;
  }

  const { from, name, subject, body, project, hrmsClientId } = result.data;

  let created: Awaited<ReturnType<typeof createTicketFromEmail>>;
  try {
    created = await createTicketFromEmail(from, name, subject, body, project, hrmsClientId);
  } catch {
    res.status(500).json({ error: "No admin user found to assign as ticket creator" });
    return;
  }

  const { ticket, admin } = created;
  res.status(201).json({ ticketId: ticket.ticketId, id: ticket.id });

  if (process.env.NODE_ENV === "test") return;

  boss.send(CLASSIFY_QUEUE, { ticketDbId: ticket.id, subject, body } satisfies ClassifyJobData)
    .then((id) => console.log(`[boss] Enqueued classify job ${id} for ticket ${ticket.ticketId}`))
    .catch((err) => console.error("[boss] Failed to enqueue classify job:", err instanceof Error ? err.message : String(err)));

  boss.send(AUTO_RESOLVE_QUEUE, { ticketDbId: ticket.id, ticketId: ticket.ticketId, subject, body, adminId: admin.id, customerName: name ?? from } satisfies AutoResolveJobData)
    .then((id) => console.log(`[boss] Enqueued auto-resolve job ${id} for ticket ${ticket.ticketId}`))
    .catch((err) => console.error("[boss] Failed to enqueue auto-resolve job:", err instanceof Error ? err.message : String(err)));
});

/* CLOUDMAILIN_INBOUND
// POST /api/webhooks/cloudmailin
// Receives inbound email from Cloudmailin and creates a ticket.
// Supports both Multipart Normalized (multipart/form-data) and JSON Normalized formats.
router.post("/cloudmailin", multipartParser.none(), async (req, res) => {
  const b = req.body ?? {};

  // Cloudmailin Multipart Normalized sends flat bracket-notation keys: headers[subject]
  // JSON Normalized sends nested objects: { headers: { subject } }
  // Handle both:
  const rawFrom: string    = b?.envelope?.from    ?? b?.["envelope[from]"]    ?? "";
  const rawSubject: string = b?.headers?.subject  ?? b?.["headers[subject]"]  ?? "";
  const rawBody: string    = (b?.plain ?? b?.html ?? "").trim();

  const safeLogFrom    = rawFrom.replace(/[\r\n]/g, " ");
  const safeLogSubject = rawSubject.replace(/[\r\n]/g, " ");
  console.log("[cloudmailin] from=%s subject=%s bodyLen=%d", safeLogFrom, safeLogSubject, rawBody.length);

  // Extract optional display name from "Name <email>" header
  const fromHeader: string = b?.headers?.from ?? b?.["headers[from]"] ?? rawFrom;
  const nameMatch = fromHeader.match(/^([^<]+)<[^>]+>/);
  const name = nameMatch ? nameMatch[1].trim().replace(/[<>"'&]/g, "") : undefined;

  const result = inboundEmailSchema.safeParse({
    from:    rawFrom,
    name,
    subject: rawSubject,
    body:    rawBody || "(no body)",  // fallback so empty-body emails still pass validation
  });

  if (!result.success) {
    console.error("[cloudmailin] validation failed:", result.error.flatten().fieldErrors);
    res.status(400).json({ fieldErrors: result.error.flatten().fieldErrors });
    return;
  }

  const { from, subject, body } = result.data;

  let created: Awaited<ReturnType<typeof createTicketFromEmail>>;
  try {
    created = await createTicketFromEmail(from, name, subject, body);
  } catch {
    res.status(500).json({ error: "No admin user found to assign as ticket creator" });
    return;
  }

  const { ticket, admin } = created;
  res.status(201).json({ ticketId: ticket.ticketId, id: ticket.id });

  if (process.env.NODE_ENV === "test") return;

  boss.send(CLASSIFY_QUEUE, { ticketDbId: ticket.id, subject, body } satisfies ClassifyJobData)
    .then((id) => console.log(`[boss] Enqueued classify job ${id} for ticket ${ticket.ticketId}`))
    .catch((err) => console.error("[boss] Failed to enqueue classify job:", err instanceof Error ? err.message : String(err)));

  boss.send(AUTO_RESOLVE_QUEUE, { ticketDbId: ticket.id, ticketId: ticket.ticketId, subject, body, adminId: admin.id, customerName: name ?? from } satisfies AutoResolveJobData)
    .then((id) => console.log(`[boss] Enqueued auto-resolve job ${id} for ticket ${ticket.ticketId}`))
    .catch((err) => console.error("[boss] Failed to enqueue auto-resolve job:", err instanceof Error ? err.message : String(err)));
});
*/

/* === IMAP inbound email processor (commented out — re-enable when IMAP Basic Auth is allowed in M365) ===
export async function processImapEmail(data: EmailData): Promise<void> {
  const { from, name, subject, body, isNewsletter } = data;

  // Validate sender email format — reject malformed addresses before they enter the DB
  if (!z.string().email().safeParse(from).success) {
    console.warn("[imap] Skipping message with invalid from address");
    return;
  }

  // Skip newsletters/marketing emails — RFC List-Unsubscribe, List-Id, etc.
  if (isNewsletter) {
    console.log("[imap] Skipping newsletter/automated email from %s", from);
    return;
  }

  // Strip quoted reply thread (lines starting with ">") to get only new content
  const cleanBody = body
    .split("\n")
    .filter((line) => !line.startsWith(">"))
    .join("\n")
    .replace(/^On .{1,200}wrote:\s*$/m, "") // remove "On [date] ... wrote:" line
    .trim() || body;

  // Check if this is a customer reply to an existing ticket.
  // Our outbound emails include "Ticket: TKT-XXXX" in the footer.
  const ticketRefMatch = body.match(/Ticket:\s*(TKT-\d{4,})/);
  if (ticketRefMatch) {
    const refTicketId = ticketRefMatch[1];
    const existingTicket = await prisma.ticket.findUnique({
      where:  { ticketId: refTicketId },
      select: { id: true, ticketId: true },
    });

    if (existingTicket) {
      const admin = await prisma.user.findFirst({ where: { role: ROLES.ADMIN } });
      if (admin) {
        await prisma.comment.create({
          data: {
            content:    cleanBody,
            senderType: "CUSTOMER",
            ticketId:   existingTicket.id,
            authorId:   admin.id,
          },
        });
        // Re-open the ticket and bump updatedAt so it surfaces at top of list
        await prisma.ticket.update({
          where: { id: existingTicket.id },
          data:  { status: STATUS.OPEN_NOT_STARTED, updatedAt: new Date() },
        });
        console.log("[imap] Added customer reply to existing ticket %s from %s", refTicketId, from);
      }
      return; // do not create a new ticket
    }
  }

  let created: Awaited<ReturnType<typeof createTicketFromEmail>>;
  try {
    created = await createTicketFromEmail(from, name, subject, cleanBody);
  } catch {
    console.error("[imap] Failed to create ticket from email sent by %s", from);
    return;
  }

  const { ticket, admin } = created;
  console.log("[imap] Created ticket %s from %s", ticket.ticketId, from);

  boss.send(CLASSIFY_QUEUE, { ticketDbId: ticket.id, subject, body: cleanBody } satisfies ClassifyJobData)
    .catch((err) => console.error("[imap] Failed to enqueue classify job:", err instanceof Error ? err.message : String(err)));

  boss.send(AUTO_RESOLVE_QUEUE, { ticketDbId: ticket.id, ticketId: ticket.ticketId, subject, body: cleanBody, adminId: admin.id, customerName: name ?? from } satisfies AutoResolveJobData)
    .catch((err) => console.error("[imap] Failed to enqueue auto-resolve job:", err instanceof Error ? err.message : String(err)));
}
=== end IMAP processor === */

// Prevents concurrent Gmail webhook processing — Pub/Sub can deliver multiple
// notifications simultaneously (e.g. after a reconnect), causing duplicate tickets
// if two handlers both call listUnprocessedMessages() before either marks as read.
let gmailProcessing = false;

// POST /api/webhooks/gmail
// Receives Gmail push notifications from Google Cloud Pub/Sub.
// Pub/Sub message format: { message: { data: base64(JSON({ emailAddress, historyId })), messageId }, subscription }
// Always respond 200 quickly to acknowledge — Pub/Sub retries on non-200 responses.
router.post("/gmail", async (req, res) => {
  // Optional shared secret verification
  if (process.env.GMAIL_PUBSUB_SECRET) {
    const secret = process.env.GMAIL_PUBSUB_SECRET;
    const token  = (req.headers["x-goog-channel-token"] as string | undefined) ?? (req.query["token"] as string | undefined);
    // H-4 — timing-safe comparison to prevent secret enumeration via timing oracle
    const valid  = token != null &&
      Buffer.byteLength(token) === Buffer.byteLength(secret) &&
      timingSafeEqual(Buffer.from(token, "utf8"), Buffer.from(secret, "utf8"));
    if (!valid) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
  }

  // Decode Pub/Sub message envelope
  const encoded = req.body?.message?.data as string | undefined;
  if (!encoded) {
    res.status(200).end(); // ack empty/test messages
    return;
  }

  let notification: { emailAddress?: string; historyId?: string };
  try {
    notification = JSON.parse(Buffer.from(encoded, "base64").toString("utf-8"));
  } catch {
    res.status(200).end();
    return;
  }

  // Acknowledge immediately — do work async after
  res.status(200).end();

  if (!isGmailApiConfigured()) return;
  if (process.env.NODE_ENV === "test") return;
  if (isCurrentlyDraining()) {
    console.log("[gmail] Draining in progress — skipping notification");
    return;
  }
  if (gmailProcessing) {
    console.log("[gmail] Already processing a notification — skipping concurrent request");
    return;
  }
  gmailProcessing = true;

  const safeHistory = (notification.historyId ?? "").replace(/[\r\n]/g, " ");
  const safeAddress = (notification.emailAddress ?? "").replace(/[\r\n]/g, " ");
  console.log("[gmail] Notification: historyId=%s emailAddress=%s", safeHistory, safeAddress);

  try {
    // Fetch unread INBOX messages and create a ticket for each unprocessed one.
    // markAsRead() is called immediately after fetching each message so it is
    // never processed again on subsequent Pub/Sub notifications.
    const messages = await listUnprocessedMessages();
    console.log("[gmail] Found %d unread message(s) in INBOX", messages.length);

    for (const msg of messages) {
      const { from, name, subject, body, isNewsletter } = await fetchEmailById(msg.id);

      // Always mark as read so we never process the same message twice
      await markAsRead(msg.id);

      // Validate sender email format — reject malformed addresses before they enter the DB
      if (!inboundEmailSchema.shape.from.safeParse(from).success) {
        console.warn("[gmail] Skipping message with invalid from address");
        continue;
      }

      // Skip newsletters/marketing emails — they have List-Unsubscribe or List-Id headers
      if (isNewsletter) {
        console.log("[gmail] Skipping newsletter/automated email from %s", from);
        continue;
      }

      // Strip quoted reply thread (lines starting with ">") to get only the new content
      const cleanBody = body
        .split("\n")
        .filter((line) => !line.startsWith(">"))
        .join("\n")
        .replace(/^On .{1,200}wrote:\s*$/m, "")  // remove "On [date] ... wrote:" line
        .trim() || body; // fallback to full body if stripping removes everything

      // Check if this is a customer reply to an existing ticket.
      // Our outbound emails include "Ticket: TKT-XXXX" in the footer.
      const ticketRefMatch = body.match(/Ticket:\s*(TKT-\d{4,})/);
      if (ticketRefMatch) {
        const refTicketId = ticketRefMatch[1];
        const existingTicket = await prisma.ticket.findUnique({
          where: { ticketId: refTicketId },
          select: { id: true, ticketId: true },
        });

        if (existingTicket) {
          const admin = await prisma.user.findFirst({ where: { role: ROLES.ADMIN } });
          if (admin) {
            await prisma.comment.create({
              data: {
                content:    cleanBody,
                senderType: "CUSTOMER",
                ticketId:   existingTicket.id,
                authorId:   admin.id,
              },
            });
            // Re-open the ticket and bump updatedAt so it surfaces at top of list
            await prisma.ticket.update({
              where: { id: existingTicket.id },
              data:  { status: STATUS.OPEN_NOT_STARTED, updatedAt: new Date() },
            });
            console.log("[gmail] Added customer reply to existing ticket %s from %s", refTicketId, from);
          }
          continue; // do not create a new ticket
        }
      }

      let created: Awaited<ReturnType<typeof createTicketFromEmail>>;
      try {
        created = await createTicketFromEmail(from, name, subject, cleanBody);
      } catch {
        console.error("[gmail] Failed to create ticket for message", msg.id);
        continue;
      }

      const { ticket, admin } = created;
      console.log("[gmail] Created ticket %s from %s", ticket.ticketId, from);

      boss.send(CLASSIFY_QUEUE, { ticketDbId: ticket.id, subject, body: cleanBody } satisfies ClassifyJobData)
        .catch((err) => console.error("[gmail] Failed to enqueue classify job:", err instanceof Error ? err.message : String(err)));

      boss.send(AUTO_RESOLVE_QUEUE, { ticketDbId: ticket.id, ticketId: ticket.ticketId, subject, body: cleanBody, adminId: admin.id, customerName: name ?? from } satisfies AutoResolveJobData)
        .catch((err) => console.error("[gmail] Failed to enqueue auto-resolve job:", err instanceof Error ? err.message : String(err)));
    }
  } catch (err) {
    console.error("[gmail] Failed to process push notification:", err instanceof Error ? err.message : String(err));
  } finally {
    gmailProcessing = false;
  }
});

export default router;
