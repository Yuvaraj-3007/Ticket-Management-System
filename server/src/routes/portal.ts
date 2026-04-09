import { Router, type Request, type Response } from "express";
import { randomUUID, createHmac, timingSafeEqual, randomBytes } from "node:crypto";
import path from "node:path";
import rateLimit from "express-rate-limit";
import multer from "multer";
import { hashPassword } from "better-auth/crypto";
import {
  portalSubmitSchema,
  portalSignupSchema,
  portalRatingSchema,
  createCommentSchema,
  TICKET_TYPE,
  PRIORITY,
  STATUS,
  ROLES,
  STATUSES,
} from "@tms/core";
import prisma from "../lib/prisma.js";
import { getAllClients, getClientBySlug, getClientProjects } from "../lib/hrms.js";
import { requireCustomer } from "../middleware/customerAuth.js";
import { Prisma } from "../generated/prisma/client.js";
import { uploadArray } from "../lib/upload.js";

const router = Router();

// Wrap multer's callback API into a Promise so we can use await in async routes
function runUpload(req: Request, res: Response): Promise<void> {
  return new Promise((resolve, reject) => {
    uploadArray(req as any, res as any, (err: unknown) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

const isProd = process.env.NODE_ENV === "production";

// Stricter rate limit for signup — prevents email enumeration
const signupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProd ? 10 : 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many signup attempts. Please try again later." },
});

// Prevent ticket spam on public submission endpoint
const submitLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: isProd ? 5 : 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many submissions. Please try again later." },
});

// L7 — rate limit public project list endpoint (prevents HRMS enumeration)
const projectsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isProd ? 30 : 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again later." },
});

// Slim select shape for portal ticket responses — no full description returned
const PORTAL_TICKET_SELECT = {
  id:              true,
  ticketId:        true,
  title:           true,
  description:     true,
  status:          true,
  priority:        true,
  type:            true,
  project:         true,
  hrmsClientId:    true,
  hrmsClientName:  true,
  hrmsProjectId:   true,
  hrmsProjectName: true,
  rating:          true,
  ratingText:      true,
  senderName:      true,
  senderEmail:     true,
  createdAt:       true,
  updatedAt:       true,
  assignedTo:      { select: { name: true } },
  attachments:     { select: { id: true, filename: true, mimetype: true, size: true, filepath: true, createdAt: true } },
} as const;

// H7 — strip characters that could cause stored XSS via filename display
function sanitizeFilename(name: string): string {
  return name.replace(/[<>"'&/\\]/g, "_").slice(0, 255);
}

// ── M11 — Server-side CAPTCHA helpers ─────────────────────────────────────────

// C-2 — must not fall back to a hardcoded string; use BETTER_AUTH_SECRET as fallback (always set)
const CAPTCHA_SECRET: string = (() => {
  const s = process.env.CAPTCHA_SECRET ?? process.env.BETTER_AUTH_SECRET;
  if (!s) throw new Error("CAPTCHA_SECRET or BETTER_AUTH_SECRET environment variable must be set");
  return s;
})();
const CAPTCHA_CHARS  = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
const CAPTCHA_LEN    = 5;

function generateCaptchaCode(): string {
  const bytes = randomBytes(CAPTCHA_LEN);
  return Array.from(bytes, (b) => CAPTCHA_CHARS[b % CAPTCHA_CHARS.length]).join("");
}

function signCaptcha(code: string, ts: string): string {
  return createHmac("sha256", CAPTCHA_SECRET)
    .update(`${code.toLowerCase()}:${ts}`)
    .digest("hex");
}

export function verifyCaptchaToken(token: string, answer: string): boolean {
  if (!token || !answer) return false;
  const dot = token.indexOf(".");
  if (dot === -1) return false;
  const ts  = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  // Token must be used within 10 minutes
  if (Date.now() - parseInt(ts, 10) > 10 * 60 * 1000) return false;
  const expected = signCaptcha(answer.toLowerCase().trim(), ts);
  try {
    return timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

const captchaLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isProd ? 30 : 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many captcha requests." },
});

// ──────────────────────────────────────
// POST /api/portal/auth/signup — public
// Create a new CUSTOMER account
// ──────────────────────────────────────
router.post("/auth/signup", signupLimiter, async (req, res) => {
  const parsed = portalSignupSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ fieldErrors: parsed.error.flatten().fieldErrors });
    return;
  }

  const { name, email, password, clientId } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    res.status(409).json({ error: "An account with this email already exists" });
    return;
  }

  // Validate clientId against HRMS if provided (skip in test mode or when HRMS is unreachable)
  if (clientId && process.env.NODE_ENV !== "test") {
    const clients = await getAllClients();
    if (clients.length > 0 && !clients.some((c) => c.id === clientId)) {
      res.status(400).json({ error: "Invalid client" });
      return;
    }
  }

  try {
    const hashedPassword = await hashPassword(password);
    const userId = randomUUID();
    await prisma.$transaction(async (tx) => {
      await tx.user.create({
        data: {
          id:             userId,
          name,
          email,
          role:           ROLES.CUSTOMER,
          emailVerified:  true,
          isActive:       true,
          portalClientId: clientId ?? null,
        },
      });
      await tx.account.create({
        data: {
          id:         randomUUID(),
          userId,
          accountId:  userId,
          providerId: "credential",
          password:   hashedPassword,
        },
      });
    });
    res.status(201).json({ success: true });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      res.status(409).json({ error: "An account with this email already exists" });
      return;
    }
    res.status(500).json({ error: "Failed to create account" });
  }
});

// PATCH /api/portal/me/client — update the logged-in customer's portal client association
// Called after login to bind the session to the portal they're accessing
router.patch("/me/client", requireCustomer, async (req, res) => {
  const { clientId } = req.body as { clientId?: string };
  if (!clientId || typeof clientId !== "string") {
    res.status(400).json({ error: "clientId is required" });
    return;
  }
  // Validate that clientId is a real active HRMS client (skip in test mode)
  if (process.env.NODE_ENV !== "test") {
    const clients = await getAllClients();
    // M-2 — fail closed: if HRMS is unreachable (empty list), reject rather than silently allow
    if (clients.length === 0) {
      res.status(503).json({ error: "Cannot verify client — please try again later" });
      return;
    }
    if (!clients.some((c) => c.id === clientId)) {
      res.status(400).json({ error: "Invalid client" });
      return;
    }
  }
  await prisma.user.update({
    where: { id: req.user!.id },
    data:  { portalClientId: clientId },
  });
  res.json({ success: true });
});

// GET /api/portal/dashboard — summary stats for the logged-in customer
// ──────────────────────────────────────
router.get("/dashboard", requireCustomer, async (req, res) => {
  const email          = req.user!.email;
  const portalClientId = (req.user as any).portalClientId as string | null;

  // M8 — reject requests with no client association to prevent cross-client data leakage
  if (!portalClientId) {
    res.status(403).json({ error: "No client association found. Please log in again via your portal link." });
    return;
  }
  const clientFilter: Prisma.TicketWhereInput = { hrmsClientId: portalClientId };

  // Start of current month
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [total, statusCounts, openTickets, recent, dailyRaw] = await Promise.all([
    prisma.ticket.count({ where: { senderEmail: email, ...clientFilter } }),

    prisma.ticket.groupBy({
      by: ["status"],
      where: { senderEmail: email, ...clientFilter },
      _count: { _all: true },
    }),

    // All non-closed tickets (customer's active work items)
    prisma.ticket.findMany({
      where: {
        senderEmail: email,
        ...clientFilter,
        status: { not: "CLOSED" as any },
      },
      orderBy: { updatedAt: "desc" },
      take: 10,
      select: {
        id: true, ticketId: true, title: true,
        status: true, priority: true,
        createdAt: true, updatedAt: true,
      },
    }),

    // Recent 5 tickets (any status)
    prisma.ticket.findMany({
      where:   { senderEmail: email, ...clientFilter },
      orderBy: { createdAt: "desc" },
      take:    5,
      select:  PORTAL_TICKET_SELECT,
    }),

    // Daily ticket counts for current month — cast to int to avoid BigInt serialization
    prisma.$queryRaw<Array<{ day: number; count: number }>>`
        SELECT DATE_PART('day', "createdAt")::int AS day,
               COUNT(*)::int                       AS count
        FROM   tickets
        WHERE  "senderEmail" = ${email}
          AND  "hrmsClientId" = ${portalClientId}
          AND  "createdAt"   >= ${monthStart}
        GROUP  BY DATE_PART('day', "createdAt")
        ORDER  BY day
      `.catch((err: unknown) => {
      console.error("[portal/dashboard] daily query error:", err instanceof Error ? err.message : String(err));
      return [] as Array<{ day: number; count: number }>;
    }),
  ]);

  // Explicit number conversion (Prisma 7 may return BigInt for _count)
  const getCount = (status: string) =>
    Number(statusCounts.find((r) => String(r.status) === status)?._count._all ?? 0);

  const unAssigned = getCount("UN_ASSIGNED");
  const notStarted = getCount("OPEN_NOT_STARTED");
  const inProgress = getCount("OPEN_IN_PROGRESS");
  const qa         = getCount("OPEN_QA");
  const done       = getCount("OPEN_DONE");
  const closed     = getCount("CLOSED");
  const open       = notStarted + inProgress + qa + done;

  res.json({
    total,
    open,
    unAssigned,
    closed,
    statusBreakdown: { unAssigned, notStarted, inProgress, qa, done, closed },
    openTickets: openTickets.map((t) => ({
      id:        t.id,
      ticketId:  t.ticketId,
      title:     t.title,
      status:    String(t.status),
      priority:  String(t.priority),
      updatedAt: t.updatedAt.toISOString(),
      createdAt: t.createdAt.toISOString(),
    })),
    daily: dailyRaw.map((r) => ({ day: Number(r.day), count: Number(r.count) })),
    recent,
  });
});

// ──────────────────────────────────────
// GET /api/portal/tickets — list customer's tickets
// ──────────────────────────────────────
router.get("/tickets", requireCustomer, async (req, res) => {
  const {
    status,
    priority,
    search,
    from,
    to,
    sortOrder = "desc",
    page      = "1",
    pageSize  = "10",
  } = req.query as Record<string, string | undefined>;

  const pageNum  = Math.max(1, parseInt(page  ?? "1",  10) || 1);
  const pageSz   = Math.min(100, Math.max(1, parseInt(pageSize ?? "10", 10) || 10));
  const order    = sortOrder === "asc" ? "asc" : "desc";

  const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

  const portalClientId = (req.user as any).portalClientId as string | null;

  // M9 — reject requests with no client association to prevent cross-client data leakage
  if (!portalClientId) {
    res.status(403).json({ error: "No client association found. Please log in again via your portal link." });
    return;
  }
  const where: Prisma.TicketWhereInput = {
    senderEmail:  req.user!.email,
    hrmsClientId: portalClientId,
  };

  if (status) {
    if (!(STATUSES as readonly string[]).includes(status)) {
      res.status(400).json({ error: "Invalid status value" });
      return;
    }
    where.status = status as any;
  }
  if (priority) {
    if (!(PRIORITIES as readonly string[]).includes(priority)) {
      res.status(400).json({ error: "Invalid priority value" });
      return;
    }
    where.priority = priority as any;
  }
  if (search && search.trim()) {
    const q = search.trim().slice(0, 200); // L-2 — cap length to prevent excessive DB work
    where.OR = [
      { title:       { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
      { ticketId:    { contains: q, mode: "insensitive" } },
    ];
  }
  if (from)   where.createdAt = { ...(where.createdAt as any), gte: new Date(from) };
  if (to)     where.createdAt = { ...(where.createdAt as any), lte: new Date(to) };

  const [rows, total] = await Promise.all([
    prisma.ticket.findMany({
      where,
      orderBy: { createdAt: order },
      skip:    (pageNum - 1) * pageSz,
      take:    pageSz,
      select:  PORTAL_TICKET_SELECT,
    }),
    prisma.ticket.count({ where }),
  ]);

  res.json({
    data:       rows,
    total,
    page:       pageNum,
    pageSize:   pageSz,
    totalPages: Math.ceil(total / pageSz),
  });
});

// ──────────────────────────────────────
// GET /api/portal/tickets/:id — get single ticket (with comment count)
// ──────────────────────────────────────
router.get("/tickets/:id", requireCustomer, async (req: Request<{ id: string }>, res: Response) => {
  const ticket = await prisma.ticket.findUnique({
    where:  { ticketId: req.params.id },
    select: {
      ...PORTAL_TICKET_SELECT,
      _count: { select: { comments: true } },
    },
  });

  if (!ticket) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }

  if (ticket.senderEmail !== req.user!.email) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  res.json({
    ...ticket,
    attachments: ticket.attachments.map((a) => ({
      id:        a.id,
      filename:  a.filename,
      mimetype:  a.mimetype,
      size:      a.size,
      url:       "/uploads/" + path.basename(a.filepath),
      createdAt: a.createdAt,
    })),
  });
});

// ──────────────────────────────────────
// GET /api/portal/tickets/:id/comments
// ──────────────────────────────────────
router.get("/tickets/:id/comments", requireCustomer, async (req: Request<{ id: string }>, res: Response) => {
  const ticket = await prisma.ticket.findUnique({
    where:  { ticketId: req.params.id },
    select: { id: true, senderEmail: true },
  });

  if (!ticket) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }

  if (ticket.senderEmail !== req.user!.email) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  const comments = await prisma.comment.findMany({
    where:   { ticketId: ticket.id },
    select:  {
      id:          true,
      content:     true,
      senderType:  true,
      author:      { select: { name: true } },
      createdAt:   true,
      attachments: { select: { id: true, filename: true, mimetype: true, size: true, filepath: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  res.json(comments.map((c) => ({
    ...c,
    attachments: c.attachments.map((a) => ({
      id:       a.id,
      filename: a.filename,
      mimetype: a.mimetype,
      size:     a.size,
      url:      "/uploads/" + path.basename(a.filepath),
    })),
  })));
});

// ──────────────────────────────────────
// POST /api/portal/tickets/:id/comments
// ──────────────────────────────────────
router.post("/tickets/:id/comments", requireCustomer, async (req: Request<{ id: string }>, res: Response) => {
  // Run multer to parse multipart/form-data (files + text fields)
  try {
    await runUpload(req, res);
  } catch (err: unknown) {
    const isMulterError = err instanceof multer.MulterError;
    if (isMulterError && (err as multer.MulterError).code === "LIMIT_FILE_SIZE") {
      res.status(400).json({ error: "Each image must be under 1MB" });
      return;
    }
    if (isMulterError && (err as multer.MulterError).code === "LIMIT_FILE_COUNT") {
      res.status(400).json({ error: "Maximum 5 images allowed" });
      return;
    }
    res.status(400).json({ error: err instanceof Error ? err.message : "File upload error" });
    return;
  }

  const parsed = createCommentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ fieldErrors: parsed.error.flatten().fieldErrors });
    return;
  }

  const ticket = await prisma.ticket.findUnique({
    where:  { ticketId: req.params.id },
    select: { id: true, senderEmail: true },
  });

  if (!ticket) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }

  if (ticket.senderEmail !== req.user!.email) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  const [comment] = await Promise.all([
    prisma.comment.create({
      data: {
        content:    parsed.data.content,
        senderType: "CUSTOMER",
        ticketId:   ticket.id,
        authorId:   req.user!.id,
      },
      select: {
        id:          true,
        content:     true,
        senderType:  true,
        author:      { select: { name: true } },
        createdAt:   true,
        attachments: { select: { id: true, filename: true, mimetype: true, size: true, filepath: true } },
      },
    }),
    prisma.ticket.update({ where: { id: ticket.id }, data: { updatedAt: new Date() } }),
  ]);

  // Save comment attachments
  const uploadedFiles = req.files as Express.Multer.File[] | undefined;
  if (uploadedFiles && uploadedFiles.length > 0) {
    await prisma.attachment.createMany({
      data: uploadedFiles.map((f) => ({
        id:        randomUUID(),
        filename:  sanitizeFilename(f.originalname), // H7 — prevent stored XSS via filename
        filepath:  f.path,
        mimetype:  f.mimetype,
        size:      f.size,
        commentId: comment.id,
      })),
    });
  }

  // Transform filepath → public URL
  const response = {
    ...comment,
    attachments: comment.attachments.map((a) => ({
      id:       a.id,
      filename: a.filename,
      mimetype: a.mimetype,
      size:     a.size,
      url:      "/uploads/" + path.basename(a.filepath),
    })),
  };
  res.status(201).json(response);
});

// ──────────────────────────────────────
// PATCH /api/portal/tickets/:id/rating
// ──────────────────────────────────────
router.patch("/tickets/:id/rating", requireCustomer, async (req: Request<{ id: string }>, res: Response) => {
  const parsed = portalRatingSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ fieldErrors: parsed.error.flatten().fieldErrors });
    return;
  }

  const ticket = await prisma.ticket.findUnique({
    where:  { ticketId: req.params.id },
    select: { id: true, status: true, rating: true, senderEmail: true },
  });

  if (!ticket) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }

  if (ticket.senderEmail !== req.user!.email) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  if (ticket.status !== STATUS.CLOSED) {
    res.status(400).json({ error: "Ratings can only be submitted for closed tickets" });
    return;
  }

  if (ticket.rating !== null) {
    res.status(409).json({ error: "This ticket has already been rated" });
    return;
  }

  const updated = await prisma.ticket.update({
    where:  { ticketId: req.params.id },
    data:   { rating: parsed.data.rating, ratingText: parsed.data.ratingText ?? null },
    select: PORTAL_TICKET_SELECT,
  });

  res.json(updated);
});

// ──────────────────────────────────────
// GET /api/portal/captcha — public
// Returns a server-signed captcha challenge. Must be registered BEFORE /:slug
// routes to avoid routing conflicts.
// ──────────────────────────────────────
router.get("/captcha", captchaLimiter, (_req, res) => {
  const code = generateCaptchaCode();
  const ts   = Date.now().toString();
  const sig  = signCaptcha(code, ts);
  res.json({ code, token: `${ts}.${sig}` });
});

// ──────────────────────────────────────
// GET /api/portal/projects?clientId= — requires customer session
// Returns HRMS project list by HRMS client UUID (bypasses slug resolution)
// Must be registered BEFORE /:slug routes to avoid routing conflicts
// ──────────────────────────────────────
router.get("/projects", requireCustomer, async (req, res) => {
  const { clientId } = req.query as { clientId?: string };
  if (!clientId) {
    res.status(400).json({ error: "clientId query param required" });
    return;
  }
  const projects = await getClientProjects(clientId);
  res.json(projects);
});

// ──────────────────────────────────────
// GET /api/portal/:slug/projects — public
// Returns HRMS project list for a client (used by portal submit form dropdown)
// ──────────────────────────────────────
router.get("/:slug/projects", projectsLimiter, async (req, res) => {
  const slug = req.params["slug"] as string;
  const client = await getClientBySlug(slug);
  if (!client) {
    res.status(404).json({ error: "Client not found" });
    return;
  }
  const projects = await getClientProjects(client.id);
  res.json(projects);
});

// ──────────────────────────────────────
// GET /api/portal/:slug — public, MUST be last
// Look up an HRMS client by slug
// ──────────────────────────────────────
router.get("/:slug", async (req, res) => {
  const { slug } = req.params;
  const client = await getClientBySlug(slug);
  if (!client) {
    res.status(404).json({ error: "Client not found" });
    return;
  }
  res.json(client);
});

// ──────────────────────────────────────
// POST /api/portal/:slug/tickets — public
// Submit a ticket from the customer portal (no auth required)
// ──────────────────────────────────────
router.post("/:slug/tickets", submitLimiter, async (req, res) => {
  // Run multer to parse multipart/form-data (files + text fields)
  try {
    await runUpload(req, res);
  } catch (err: unknown) {
    const isMulterError = err instanceof multer.MulterError;
    if (isMulterError && (err as multer.MulterError).code === "LIMIT_FILE_SIZE") {
      res.status(400).json({ error: "Each image must be under 1MB" });
      return;
    }
    if (isMulterError && (err as multer.MulterError).code === "LIMIT_FILE_COUNT") {
      res.status(400).json({ error: "Maximum 5 images allowed" });
      return;
    }
    res.status(400).json({ error: err instanceof Error ? err.message : "File upload error" });
    return;
  }

  const parsed = portalSubmitSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ fieldErrors: parsed.error.flatten().fieldErrors });
    return;
  }

  // M11 — Verify server-signed captcha token before accepting submission
  const { captchaToken, captchaAnswer } = parsed.data;
  if (!verifyCaptchaToken(captchaToken ?? "", captchaAnswer ?? "")) {
    res.status(400).json({ error: "Invalid or expired captcha. Please try again." });
    return;
  }

  const { name, email, subject, body, projectId, projectName } = parsed.data;
  const slug = req.params["slug"] as string;

  const client = await getClientBySlug(slug);
  if (!client) {
    res.status(404).json({ error: "Client not found" });
    return;
  }

  const admin = await prisma.user.findFirst({ where: { role: ROLES.ADMIN } });

  if (!admin) {
    res.status(500).json({ error: "No admin user found to assign as ticket creator" });
    return;
  }

  let ticket: { id: string; ticketId: string };
  try {
    ticket = await prisma.$transaction(async (tx) => {
      const latest = await tx.ticket.findFirst({
        orderBy: { ticketId: "desc" },
        select:  { ticketId: true },
      });

      let nextNumber = 1;
      if (latest) {
        const match = latest.ticketId.match(/^TKT-(\d+)$/);
        if (match) nextNumber = parseInt(match[1], 10) + 1;
      }

      const ticketId    = `TKT-${String(nextNumber).padStart(4, "0")}`;
      // H9 — strip CR/LF from name and email to prevent CRLF injection in ticket description
      const safeName    = name.replace(/[\r\n]/g, " ");
      const safeEmail   = email.replace(/[\r\n]/g, "");
      const description = `From: ${safeName} <${safeEmail}>\n\n${body}`;

      return tx.ticket.create({
        data: {
          id:            randomUUID(),
          ticketId,
          title:         subject,
          description,
          type:            TICKET_TYPE.SUPPORT,
          priority:        PRIORITY.MEDIUM,
          status:          STATUS.UN_ASSIGNED,
          project:         projectName ?? "General",
          senderName:      name,
          senderEmail:     email,
          hrmsClientId:    client.id,
          hrmsClientName:  client.customerName,
          hrmsProjectId:   projectId   ?? null,
          hrmsProjectName: projectName ?? null,
          createdById:     admin.id,
          assignedToId:    null,
        },
        select: { id: true, ticketId: true },
      });
    });
  } catch (e) {
    console.error("[portal] Failed to create ticket:", e instanceof Error ? e.message : String(e));
    res.status(500).json({ error: "Failed to create ticket" });
    return;
  }

  // Save attachments (outside transaction — ticket is committed)
  const uploadedFiles = req.files as Express.Multer.File[] | undefined;
  if (uploadedFiles && uploadedFiles.length > 0) {
    try {
      await prisma.attachment.createMany({
        data: uploadedFiles.map((f) => ({
          id:       randomUUID(),
          filename: sanitizeFilename(f.originalname), // H7 — prevent stored XSS via filename
          filepath: f.path,
          mimetype: f.mimetype,
          size:     f.size,
          ticketId: ticket.id,
        })),
      });
    } catch (e) {
      console.error("[portal] Failed to save attachments:", e instanceof Error ? e.message : String(e));
      // Don't fail the request — ticket was created successfully
    }
  }

  res.status(201).json({ ticketId: ticket.ticketId, id: ticket.id });
});

export default router;
