import { Router } from "express";
import { randomUUID } from "node:crypto";
import multer from "multer";
import { inboundEmailSchema, TICKET_TYPE, PRIORITY, STATUS, ROLES } from "@tms/core";
import prisma from "../lib/prisma.js";
import boss from "../lib/boss.js";
import { CLASSIFY_QUEUE, type ClassifyJobData } from "../workers/classify.js";
import { AUTO_RESOLVE_QUEUE, type AutoResolveJobData } from "../workers/auto-resolve.js";

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
    const description = name
      ? `From: ${name} <${from}>\n\n${body}`
      : `From: ${from}\n\n${body}`;

    return tx.ticket.create({
      data: {
        id:          randomUUID(),
        ticketId,
        title:       subject,
        description,
        type:        TICKET_TYPE.SUPPORT,
        priority:    PRIORITY.MEDIUM,
        status:      process.env.NODE_ENV === "test" ? STATUS.OPEN : STATUS.NEW,
        project:     project ?? "Email Intake",
        senderName:  name ?? null,
        senderEmail: from,
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

  const { from, name, subject, body, project } = result.data;

  let created: Awaited<ReturnType<typeof createTicketFromEmail>>;
  try {
    created = await createTicketFromEmail(from, name, subject, body, project);
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

export default router;
