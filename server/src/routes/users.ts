import { Router, Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { Prisma } from "../generated/prisma/client.js";
import prisma from "../lib/prisma.js";
import { requireAdmin } from "../middleware/auth.js";
import { ROLES, STATUS, createUserSchema, editUserSchema } from "@tms/core";
import { runHrmsSync } from "../workers/sync-hrms.js";

const router = Router();

// All routes require admin
router.use(requireAdmin);

// GET /api/users — list all users (TMS accounts + HRMS employees merged)
// HRMS employees without TMS accounts are auto-provisioned as Agents on first load.
router.get("/", async (_req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      where: { role: { in: [ROLES.ADMIN, ROLES.AGENT] } },
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });

    res.json(users.map((u) => ({ ...u, createdAt: u.createdAt.toISOString(), source: "TMS" as const })));
  } catch {
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// POST /api/users — create a new user
router.post("/", async (req: Request, res: Response) => {
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ fieldErrors: parsed.error.flatten().fieldErrors });
    return;
  }
  const { name, email, password, role } = parsed.data;

  try {
    // Pre-check for a clear 409 (P2002 catch below handles the race)
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({ error: "A user with this email already exists" });
      return;
    }

    const hashedPassword = await hashPassword(password);
    const userId = randomUUID();

    // Password is stored on the Account model (Better Auth credential provider),
    // not on the User model — this is intentional and matches the schema.
    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          id: userId,
          name,
          email,
          role: role ?? ROLES.AGENT,
          emailVerified: true,
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          createdAt: true,
        },
      });

      await tx.account.create({
        data: {
          id: randomUUID(),
          userId,
          accountId: userId,
          providerId: "credential",
          password: hashedPassword,
        },
      });

      return newUser;
    });

    res.status(201).json(user);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      res.status(409).json({ error: "A user with this email already exists" });
      return;
    }
    res.status(500).json({ error: "Failed to create user" });
  }
});

// PUT /api/users/:id — update user name, email, role, and optionally password
router.put("/:id", async (req: Request<{ id: string }>, res: Response) => {
  const id = req.params.id;

  const parsed = editUserSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ fieldErrors: parsed.error.flatten().fieldErrors });
    return;
  }
  const { name, email, role, password } = parsed.data;

  if (!req.user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  try {
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    // Prevent admin from removing their own admin role
    if (role && role !== ROLES.ADMIN && req.user.id === existing.id) {
      res.status(400).json({ error: "You cannot remove your own admin role" });
      return;
    }

    if (email && email !== existing.email) {
      const emailTaken = await prisma.user.findUnique({ where: { email } });
      if (emailTaken) {
        res.status(409).json({ error: "A user with this email already exists" });
        return;
      }
    }

    // Use parsed values directly — Zod already validated name, email, and role
    const user = await prisma.user.update({
      where: { id },
      data: { name, email, role },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    // M-4 — always invalidate sessions on any user update (role/email change takes effect immediately)
    await prisma.session.deleteMany({ where: { userId: id } });

    if (password) {
      const hashedPassword = await hashPassword(password);
      await prisma.account.updateMany({
        where: { userId: id, providerId: "credential" },
        data: { password: hashedPassword },
      });
    }

    res.json(user);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      res.status(409).json({ error: "A user with this email already exists" });
      return;
    }
    res.status(500).json({ error: "Failed to update user" });
  }
});

// PATCH /api/users/:id/status — activate/deactivate user
router.patch("/:id/status", async (req: Request<{ id: string }>, res: Response) => {
  const id = req.params.id;
  const { isActive } = req.body;

  if (typeof isActive !== "boolean") {
    res.status(400).json({ error: "isActive must be a boolean" });
    return;
  }

  if (!req.user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  try {
    // Existence check first, then self-deactivation guard
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    if (req.user.id === existing.id && !isActive) {
      res.status(400).json({ error: "You cannot deactivate your own account" });
      return;
    }

    const user = await prisma.user.update({
      where: { id },
      data: { isActive },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    res.json(user);
  } catch {
    res.status(500).json({ error: "Failed to update user status" });
  }
});

// DELETE /api/users/:id — permanently delete a user
router.delete("/:id", async (req: Request<{ id: string }>, res: Response) => {
  const id = req.params.id;

  if (!req.user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  if (req.user.id === id) {
    res.status(400).json({ error: "You cannot delete your own account" });
    return;
  }

  try {
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const adminId = req.user.id;

    await prisma.$transaction(async (tx) => {
      // Unassign tickets assigned to this user
      await tx.ticket.updateMany({ where: { assignedToId: id }, data: { assignedToId: null } });
      // Reassign ticket ownership, comments, and history to the acting admin
      await tx.ticket.updateMany({ where: { createdById: id }, data: { createdById: adminId } });
      await tx.comment.updateMany({ where: { authorId: id }, data: { authorId: adminId } });
      await tx.ticketHistory.updateMany({ where: { changedById: id }, data: { changedById: adminId } });
      // Delete auth records then the user
      await tx.session.deleteMany({ where: { userId: id } });
      await tx.account.deleteMany({ where: { userId: id } });
      await tx.user.delete({ where: { id } });
    });

    res.status(204).send();
  } catch {
    res.status(500).json({ error: "Failed to delete user" });
  }
});

// POST /api/users/sync-hrms — manually trigger HRMS employee sync
router.post("/sync-hrms", async (_req: Request, res: Response) => {
  try {
    const result = await runHrmsSync();
    res.json(result);
  } catch {
    res.status(500).json({ error: "HRMS sync failed" });
  }
});

// GET /api/users/:id/stats — per-agent performance stats
router.get("/:id/stats", async (req: Request<{ id: string }>, res: Response) => {
  const { id } = req.params;

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, role: true, isActive: true },
  });

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  try {
    const [byStatus, byPriority, byType, byProject, ratingAgg, closedTickets, recentTickets, monthlyRaw] =
      await Promise.all([
        prisma.ticket.groupBy({
          by: ["status"],
          where: { assignedToId: id },
          _count: { status: true },
        }),
        prisma.ticket.groupBy({
          by: ["priority"],
          where: { assignedToId: id },
          _count: { priority: true },
        }),
        prisma.ticket.groupBy({
          by: ["type"],
          where: { assignedToId: id },
          _count: { type: true },
        }),
        prisma.ticket.groupBy({
          by: ["hrmsProjectName"],
          where: { assignedToId: id, hrmsProjectName: { not: null } },
          _count: { hrmsProjectName: true },
          orderBy: { _count: { hrmsProjectName: "desc" } },
          take: 10,
        }),
        prisma.ticket.aggregate({
          where: { assignedToId: id, rating: { not: null } },
          _avg: { rating: true },
          _count: { rating: true },
        }),
        prisma.ticket.findMany({
          where: { assignedToId: id, status: STATUS.CLOSED },
          select: { createdAt: true, updatedAt: true },
        }),
        prisma.ticket.findMany({
          where: { assignedToId: id },
          orderBy: { updatedAt: "desc" },
          take: 30,
          select: {
            ticketId: true, title: true, status: true, priority: true,
            type: true, hrmsProjectName: true, createdAt: true, updatedAt: true, rating: true,
          },
        }),
        prisma.$queryRaw<Array<{ month: string; month_date: Date; opened: bigint; closed: bigint }>>`
          SELECT
            TO_CHAR(DATE_TRUNC('month', "createdAt"), 'Mon YY') AS month,
            DATE_TRUNC('month', "createdAt")                    AS month_date,
            COUNT(*)                                            AS opened,
            COUNT(CASE WHEN status = 'CLOSED' THEN 1 END)      AS closed
          FROM tickets
          WHERE "assignedToId" = ${id}
            AND "createdAt" >= DATE_TRUNC('month', NOW()) - INTERVAL '5 months'
          GROUP BY DATE_TRUNC('month', "createdAt")
          ORDER BY DATE_TRUNC('month', "createdAt")
        `,
      ]);

    const totalAssigned = byStatus.reduce((s, r) => s + r._count.status, 0);
    const totalClosed   = byStatus.find((r) => r.status === STATUS.CLOSED)?._count.status ?? 0;
    const avgResolutionMs =
      closedTickets.length > 0
        ? closedTickets.reduce((s, t) => s + (t.updatedAt.getTime() - t.createdAt.getTime()), 0) /
          closedTickets.length
        : null;

    res.json({
      user,
      summary: {
        totalAssigned,
        totalClosed,
        avgResolutionMs,
        avgRating:  ratingAgg._avg.rating,
        ratedCount: ratingAgg._count.rating,
      },
      byStatus:  byStatus.map((r) => ({ status: r.status, count: r._count.status })),
      byPriority: byPriority.map((r) => ({ priority: r.priority, count: r._count.priority })),
      byType:    byType.map((r) => ({ type: r.type, count: r._count.type })),
      byProject: byProject.map((r) => ({ project: r.hrmsProjectName ?? "Unknown", count: r._count.hrmsProjectName })),
      monthlyTrend: monthlyRaw.map((r) => ({
        month:  r.month,
        opened: Number(r.opened),
        closed: Number(r.closed),
      })),
      recentTickets: recentTickets.map((t) => ({
        ticketId:       t.ticketId,
        title:          t.title,
        status:         t.status,
        priority:       t.priority,
        type:           t.type,
        project:        t.hrmsProjectName ?? null,
        createdAt:      t.createdAt.toISOString(),
        updatedAt:      t.updatedAt.toISOString(),
        resolutionDays: t.status === STATUS.CLOSED
          ? Math.round((t.updatedAt.getTime() - t.createdAt.getTime()) / (1000 * 60 * 60 * 24))
          : null,
        rating: t.rating ?? null,
      })),
    });
  } catch (e) {
    console.error("[stats]", e);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

export default router;
