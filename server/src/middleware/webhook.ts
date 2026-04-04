import { Request, Response, NextFunction } from "express";
import { timingSafeEqual } from "node:crypto";

export function requireWebhookSecret(req: Request, res: Response, next: NextFunction): void {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) {
    // No secret configured — allow all (useful in dev/test)
    next();
    return;
  }
  const auth = req.headers["authorization"] ?? "";
  const expected = `Bearer ${secret}`;
  // Use constant-time comparison to prevent timing attacks
  const valid =
    auth.length === expected.length &&
    timingSafeEqual(Buffer.from(auth), Buffer.from(expected));
  if (!valid) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}
