import { Router } from "express";
import { randomUUID } from "node:crypto";
import { inboundEmailSchema, TICKET_TYPE, PRIORITY, STATUS, ROLES } from "@tms/core";
import prisma from "../lib/prisma.js";
import boss from "../lib/boss.js";
import { CLASSIFY_QUEUE, type ClassifyJobData } from "../workers/classify.js";
import { AUTO_RESOLVE_QUEUE, type AutoResolveJobData } from "../workers/auto-resolve.js";

const router = Router();

// POST /api/webhooks/email
// Accepts a simulated inbound email payload and creates a ticket.
router.post("/email", async (req, res) => {
  const result = inboundEmailSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ fieldErrors: result.error.flatten().fieldErrors });
    return;
  }

  const { from, name, subject, body, project } = result.data;

  // Find a system admin (ticket creator) and the AI agent (initial assignee)
  const [admin, aiAgent] = await Promise.all([
    prisma.user.findFirst({ where: { role: ROLES.ADMIN } }),
    prisma.user.findUnique({ where: { email: "ai@system.internal" } }),
  ]);
  if (!admin) {
    res.status(500).json({ error: "No admin user found to assign as ticket creator" });
    return;
  }

  // Generate next ticket ID (TKT-XXXX) — use a transaction to avoid races
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
        // Skip AI pipeline in test mode — create as OPEN so tickets are
        // immediately visible and workers don't race with test assertions
        status:       process.env.NODE_ENV === "test" ? STATUS.OPEN : STATUS.NEW,
        project:      project ?? "Email Intake",
        createdById:  admin.id,
        assignedToId: aiAgent?.id ?? null,
      },
      select: { id: true, ticketId: true },
    });
  });

  res.status(201).json({ ticketId: ticket.ticketId, id: ticket.id });

  // Skip jobs in test mode — workers are disabled and tickets are already OPEN
  if (process.env.NODE_ENV === "test") return;

  // Enqueue background jobs — durable, retried automatically by pg-boss
  boss.send(CLASSIFY_QUEUE, { ticketDbId: ticket.id, subject, body } satisfies ClassifyJobData)
    .then((id) => console.log(`[boss] Enqueued classify job ${id} for ticket ${ticket.ticketId}`))
    .catch((err) => console.error("[boss] Failed to enqueue classify job:", err instanceof Error ? err.message : String(err)));

  boss.send(AUTO_RESOLVE_QUEUE, { ticketDbId: ticket.id, ticketId: ticket.ticketId, subject, body, adminId: admin.id, customerName: name ?? from } satisfies AutoResolveJobData)
    .then((id) => console.log(`[boss] Enqueued auto-resolve job ${id} for ticket ${ticket.ticketId}`))
    .catch((err) => console.error("[boss] Failed to enqueue auto-resolve job:", err instanceof Error ? err.message : String(err)));
});

export default router;
