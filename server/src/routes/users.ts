import { Router, Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { Prisma } from "../generated/prisma/client.js";
import prisma from "../lib/prisma.js";
import { requireAdmin } from "../middleware/auth.js";
import { ROLES, createUserSchema, editUserSchema } from "@tms/core";
import { getEmployeeDirectory } from "../lib/hrms.js";

const router = Router();

// All routes require admin
router.use(requireAdmin);

// GET /api/users — list all users (TMS accounts + HRMS employees merged)
router.get("/", async (_req: Request, res: Response) => {
  try {
    const [tmsUsers, hrmsEmployees] = await Promise.all([
      prisma.user.findMany({
        where: { role: { in: ["ADMIN", "AGENT"] } },
        select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      }),
      getEmployeeDirectory(),
    ]);

    // TMS users with source flag
    const tmsEmailSet = new Set(tmsUsers.map((u) => u.email.toLowerCase()));
    const tmsResult = tmsUsers.map((u) => ({
      ...u,
      createdAt: u.createdAt.toISOString(),
      source: "TMS" as const,
    }));

    // HRMS-only employees (not yet in TMS)
    const hrmsOnly = hrmsEmployees
      .filter((e) => e.email && !tmsEmailSet.has(e.email.toLowerCase()))
      .map((e) => ({
        id:        `hrms:${e.id}`,
        name:      e.name,
        email:     e.email,
        role:      "AGENT" as const,
        isActive:  true,
        createdAt: null,
        source:    "HRMS" as const,
      }));

    res.json([...tmsResult, ...hrmsOnly]);
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

export default router;
