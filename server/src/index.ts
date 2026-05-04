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
import internalRoutes from "./routes/internal.js";
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

// Fail fast if the auth secret is missing — without it Better Auth generates a
// random secret each restart, invalidating every user session on restart.
if (!process.env.BETTER_AUTH_SECRET) {
  console.error(
    "[FATAL] BETTER_AUTH_SECRET is not set. All user sessions will be invalidated on every restart. " +
    "Set a stable random string (e.g. openssl rand -base64 32) in your .env file."
  );
  if (process.env.NODE_ENV === "production") {
    process.exit(1);
  }
}

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

// Prevent pg / pg-boss connection drops from crashing the entire process.
// pg.Pool emits 'error' events on dropped connections; if nothing catches
// them they become uncaughtExceptions and kill the server (→ Nginx 502).
// pg-boss has built-in reconnect logic, so we log + report and stay alive.
process.on("uncaughtException", (err) => {
  console.error("[process] uncaughtException (survived):", err.message);
  Sentry.captureException(err);
});
process.on("unhandledRejection", (reason) => {
  const err = reason instanceof Error ? reason : new Error(String(reason));
  console.error("[process] unhandledRejection (survived):", err.message);
  Sentry.captureException(err);
});

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
const PORT = process.env.PORT || 3000;

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
// `setHeaders` runs after express.static resolves the MIME type, so we can
// override the `application/octet-stream` fallback that mime-db returns for
// non-standard JPEG aliases (.jfif from Google Images, .jpe). Without this,
// `nosniff` prevents browsers from rendering them inside <img>.
app.use("/uploads", express.static(path.resolve(__dirname, "../uploads"), {
  setHeaders(res, filePath) {
    res.setHeader("Content-Disposition", "attachment");
    res.setHeader("X-Content-Type-Options", "nosniff");
    const ext = path.extname(filePath).toLowerCase();
    if (ext === ".jfif" || ext === ".jpe") {
      res.setHeader("Content-Type", "image/jpeg");
    }
  },
}));

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
app.use("/api/internal", internalRoutes);
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

  // Retry pg-boss startup up to 5 times with a 10 s delay between attempts.
  // On a fresh deploy, the DB connection pool can be momentarily saturated by
  // migration + seed connections, causing ECONNREFUSED for the first connect.
  async function startBossWithRetry(attemptsLeft = 5): Promise<void> {
    try {
      await boss.start();
      await Promise.all([registerClassifyWorker(), registerAutoResolveWorker(), registerSyncHrmsWorker()]);
      await boss.schedule(SYNC_HRMS_QUEUE, "0 2 * * *", {});
      await watchInbox();
      console.log("[boss] Workers registered");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (attemptsLeft > 1) {
        console.warn(`[boss] Startup failed (${msg}), retrying in 10 s… (${attemptsLeft - 1} attempts left)`);
        await new Promise((r) => setTimeout(r, 10_000));
        return startBossWithRetry(attemptsLeft - 1);
      }
      console.error("[boss] Failed to start after all retries:", msg);
      Sentry.captureException(err, { tags: { source: "pg-boss-startup" } });
    }
  }
  startBossWithRetry();

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
  console.log(`[config] BETTER_AUTH_URL : ${process.env.BETTER_AUTH_URL ?? "(not set — sessions will break in production)"}`);
  console.log(`[config] CLIENT_URL      : ${process.env.CLIENT_URL      ?? "(not set — CORS uses localhost default)"}`);
  console.log(`[config] NODE_ENV        : ${process.env.NODE_ENV        ?? "development"}`);
});

export default app;
