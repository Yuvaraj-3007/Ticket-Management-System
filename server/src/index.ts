import * as Sentry from "@sentry/node";
import http from "http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./lib/auth.js";
import userRoutes from "./routes/users.js";
import ticketRoutes from "./routes/tickets.js";
import webhookRoutes from "./routes/webhooks.js";
import portalRoutes from "./routes/portal.js";
import analyticsRoutes from "./routes/analytics.js";
import { requireWebhookSecret } from "./middleware/webhook.js";
import boss from "./lib/boss.js";
import { registerClassifyWorker } from "./workers/classify.js";
import { registerAutoResolveWorker } from "./workers/auto-resolve.js";
import { registerSyncHrmsWorker, SYNC_HRMS_QUEUE } from "./workers/sync-hrms.js";
import { watchInbox, isGmailApiConfigured } from "./lib/gmail.js";
/* === IMAP (commented out — re-enable when IMAP Basic Auth is allowed in M365) ===
import { watchImapInbox, isImapConfigured, resetImapClient } from "./lib/imap.js";
import { processImapEmail } from "./routes/webhooks.js";
=== end IMAP === */

dotenv.config();

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: !!process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV ?? "development",
  beforeSend(event) {
    if (event.request?.data && typeof event.request.data === "object") {
      const data = event.request.data as Record<string, unknown>;
      for (const key of ["password", "token", "secret", "apiKey", "api_key"]) {
        delete data[key];
      }
    }
    return event;
  },
});

if (process.env.NODE_ENV === "production" && !process.env.SENTRY_DSN) {
  console.warn("WARNING: SENTRY_DSN is not set — error reporting to Sentry is disabled.");
}

// Guard: refuse to start in production without a webhook secret
if (process.env.NODE_ENV === "production" && !process.env.WEBHOOK_SECRET) {
  console.error("FATAL: WEBHOOK_SECRET must be set in production. Exiting.");
  process.exit(1);
}

// Guard: refuse to start in production without an AI API key
if (process.env.NODE_ENV === "production" && !process.env.MOONSHOT_API_KEY) {
  console.error("FATAL: MOONSHOT_API_KEY must be set in production. Exiting.");
  process.exit(1);
}
if (!process.env.MOONSHOT_API_KEY) {
  console.warn("WARNING: MOONSHOT_API_KEY is not set — AI polish will return 503.");
}

// Guard: refuse to start in production without HRMS credentials
if (process.env.NODE_ENV === "production" &&
    (!process.env.HRMS_API_URL || !process.env.HRMS_API_EMAIL || !process.env.HRMS_API_PASSWORD)) {
  console.error("FATAL: HRMS_API_URL, HRMS_API_EMAIL, and HRMS_API_PASSWORD must be set in production. Exiting.");
  process.exit(1);
}
if (!process.env.HRMS_API_URL) {
  console.warn("WARNING: HRMS_API_URL not set — HRMS integration disabled (dev fallback active).");
}

if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
  console.warn("WARNING: GMAIL_USER / GMAIL_APP_PASSWORD not set — outbound reply emails will be skipped.");
}
if (!isGmailApiConfigured()) {
  console.warn("WARNING: Gmail API not configured — inbound Gmail emails will be skipped.");
}

const app = express();
const PORT = process.env.PORT || 5000;

// Trust one proxy hop so req.ip reflects the real client IP (not proxy IP)
app.set("trust proxy", 1);

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:     ["'self'"],
      scriptSrc:      ["'self'"],
      styleSrc:       ["'self'", "'unsafe-inline'"],
      imgSrc:         ["'self'", "data:", "blob:"],
      connectSrc:     ["'self'"],
      fontSrc:        ["'self'", "data:"],
      objectSrc:      ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
}));

// CORS
app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:5173",
  credentials: true,
}));

app.use(express.json({ limit: "50kb" }));
app.use(express.urlencoded({ extended: true, limit: "50kb" }));

// Serve uploaded attachments as static files
// Force download + nosniff to prevent stored XSS via HTML/SVG files rendered inline
const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use("/uploads", (_req, res, next) => {
  res.setHeader("Content-Disposition", "attachment");
  res.setHeader("X-Content-Type-Options", "nosniff");
  next();
}, express.static(path.resolve(__dirname, "../../uploads")));

// General API rate limit — applied in all environments (stricter in production)
const isProd = process.env.NODE_ENV === "production";

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProd ? 100 : 500,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api", apiLimiter);

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

// API routes
app.use("/api/users", userRoutes);
app.use("/api/tickets", ticketRoutes);
app.use("/api/portal", portalRoutes);
app.use("/api/analytics", analyticsRoutes);
const webhookLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProd ? 20 : 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many webhook requests. Please try again later." },
});
app.use("/api/webhooks", webhookLimiter, requireWebhookSecret, webhookRoutes);

Sentry.setupExpressErrorHandler(app);

// Global error handler — converts Express HTML error pages to JSON
// Must be registered after all routes
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const status = (err as any)?.status ?? (err as any)?.statusCode ?? 500;
  if ((err as any)?.type === "entity.parse.failed") {
    res.status(400).json({ error: "Invalid JSON in request body" });
    return;
  }
  res.status(status).json({ error: "Internal server error" });
});

// Create HTTP server — route /api/auth to Better Auth, rest to Express
// Note: /api/auth bypasses Express middleware, so auth rate limiting is
// handled by Better Auth's built-in protections
const betterAuthHandler = toNodeHandler(auth);
const server = http.createServer((req, res) => {
  if (req.url?.startsWith("/api/auth")) {
    betterAuthHandler(req, res);
  } else {
    app(req, res);
  }
});

// Start pg-boss and register workers (skip in test — prevents classify worker
// from overwriting ticket fields that E2E tests set, causing race conditions)
if (process.env.NODE_ENV !== "test") {
  boss.on("error", (err) => {
    console.error("[boss] error:", err);
    Sentry.captureException(err, { tags: { source: "pg-boss" } });
  });
  boss.start()
    .then(() => Promise.all([registerClassifyWorker(), registerAutoResolveWorker(), registerSyncHrmsWorker()]))
    .then(() => boss.schedule(SYNC_HRMS_QUEUE, "0 2 * * *", {}))
    .then(() => watchInbox())
    .then(() => console.log("[boss] Workers registered"))
    .catch((err) => console.error("[boss] Failed to start:", err));

  /* === IMAP startup (commented out — re-enable when IMAP Basic Auth is allowed in M365) ===
  async function startImapWithRetry() {
    if (!isImapConfigured()) return;
    while (true) {
      await watchImapInbox(processImapEmail).catch((err) => {
        console.error("[imap] Error:", err instanceof Error ? err.message : String(err));
        if (err?.response) console.error("[imap] Server response:", err.response);
        if (err?.authenticationFailed) console.error("[imap] Authentication failed — check SUPPORT_EMAIL and SUPPORT_PASSWORD, and ensure IMAP Basic Auth is enabled in M365 Exchange Admin.");
      });
      console.log("[imap] Reconnecting in 10s...");
      resetImapClient();
      await new Promise((r) => setTimeout(r, 10_000));
    }
  }
  startImapWithRetry();
  === end IMAP startup === */
}

// H-3 — warn in all environments when WEBHOOK_SECRET is absent
if (!process.env.WEBHOOK_SECRET) {
  console.warn("[startup] WARNING: WEBHOOK_SECRET is not set — /api/webhooks/email accepts unauthenticated requests");
}

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

export default app;
