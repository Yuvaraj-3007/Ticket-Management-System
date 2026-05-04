import { Router, type Request, type Response } from "express";
import { requireAuth } from "../middleware/auth.js";
import prisma from "../lib/prisma.js";
import { internalSubmitSchema, ROLES, type StatusValue } from "@tms/core";
import { type Status } from "../generated/prisma/client.js";

const router = Router();

router.use(requireAuth);

// Block CUSTOMER-role sessions
router.use((req, res, next) => {
  const role = (req as any).user?.role;
  if (role !== ROLES.ADMIN && role !== ROLES.AGENT) {
    res.status(403).json({ error: "Access denied" });
    return;
  }
  next();
});

const INTERNAL_SELECT = {
  id:        true,
  ticketId:  true,
  title:     true,
  type:      true,
  priority:  true,
  status:    true,
  createdAt: true,
  updatedAt: true,
  assignedTo: { select: { id: true, name: true } },
} as const;

// POST /api/internal/tickets — submit a ticket on behalf of the logged-in agent
router.post("/tickets", async (req: Request, res: Response) => {
  const parsed = internalSubmitSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ fieldErrors: parsed.error.flatten().fieldErrors });
    return;
  }
  const { title, description, type, priority } = parsed.data;
  const user = req.user!;

  try {
    const count = await prisma.ticket.count();
    const ticketId = `TKT-${String(count + 1).padStart(4, "0")}`;

    const ticket = await prisma.ticket.create({
      data: {
        ticketId,
        title,
        description,
        type,
        priority,
        status:      "UN_ASSIGNED",
        project:     "Internal",
        senderName:  user.name,
        senderEmail: user.email,
        createdById: user.id,
      },
      select: INTERNAL_SELECT,
    });

    res.status(201).json(ticket);
  } catch {
    res.status(500).json({ error: "Failed to create ticket" });
  }
});

// GET /api/internal/tickets — list tickets submitted by the logged-in agent
router.get("/tickets", async (req: Request, res: Response) => {
  const page     = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize) || 20));
  const status   = typeof req.query.status === "string" && req.query.status ? req.query.status : undefined;
  const userId   = req.user!.id;

  try {
    const where = {
      createdById: userId,
      ...(status ? { status: status as Status } : {}),
    };

    const [tickets, total] = await Promise.all([
      prisma.ticket.findMany({
        where,
        select:  INTERNAL_SELECT,
        orderBy: { createdAt: "desc" },
        skip:    (page - 1) * pageSize,
        take:    pageSize,
      }),
      prisma.ticket.count({ where }),
    ]);

    res.json({ data: tickets, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
  } catch {
    res.status(500).json({ error: "Failed to fetch tickets" });
  }
});

// GET /api/internal/tickets/:id — get a single ticket (must be owned by the agent)
router.get("/tickets/:id", async (req: Request<{ id: string }>, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;

  try {
    const ticket = await prisma.ticket.findFirst({
      where: { ticketId: id, createdById: userId },
      select: {
        id:          true,
        ticketId:    true,
        title:       true,
        description: true,
        type:        true,
        priority:    true,
        status:      true,
        createdAt:   true,
        updatedAt:   true,
        assignedTo:  { select: { id: true, name: true } },
        attachments: { select: { id: true, filename: true, mimetype: true, size: true, filepath: true, createdAt: true } },
      },
    });

    if (!ticket) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }

    res.json(ticket);
  } catch {
    res.status(500).json({ error: "Failed to fetch ticket" });
  }
});

export default router;
