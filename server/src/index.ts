import * as Sentry from "@sentry/node";
import http from "http";
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
import { requireWebhookSecret } from "./middleware/webhook.js";
import boss from "./lib/boss.js";
import { registerClassifyWorker } from "./workers/classify.js";
import { registerAutoResolveWorker } from "./workers/auto-resolve.js";

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
if (!process.env.CLOUDMAILIN_SMTP_HOST) {
  console.warn("WARNING: CLOUDMAILIN_SMTP_* vars not set — outbound reply emails will be skipped.");
}

const app = express();
const PORT = process.env.PORT || 5000;

// Trust one proxy hop so req.ip reflects the real client IP (not proxy IP)
app.set("trust proxy", 1);

// Security headers
app.use(helmet());

// CORS
app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:5173",
  credentials: true,
}));

app.use(express.json({ limit: "50kb" }));
app.use(express.urlencoded({ extended: true, limit: "50kb" }));

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
    .then(() => Promise.all([registerClassifyWorker(), registerAutoResolveWorker()]))
    .then(() => console.log("[boss] Workers registered"))
    .catch((err) => console.error("[boss] Failed to start:", err));
}

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

export default app;
