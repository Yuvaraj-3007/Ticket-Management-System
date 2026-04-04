import { Request, Response, NextFunction } from "express";
import { auth } from "../lib/auth.js";
import { fromNodeHeaders } from "better-auth/node";
import { ROLES } from "@tms/core";

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  if (!session) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  if (!(session.user as any).isActive) {
    res.status(403).json({ error: "Account is deactivated" });
    return;
  }

  req.user = session.user as any;
  req.session = session.session as any;
  next();
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  await requireAuth(req, res, () => {
    if (req.user?.role !== ROLES.ADMIN) {
      res.status(403).json({ error: "Admin access required" });
      return;
    }
    next();
  });
}
