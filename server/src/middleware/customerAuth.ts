import type { Request, Response, NextFunction } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../lib/auth.js";
import { ROLES } from "@tms/core";
import prisma from "../lib/prisma.js";

export async function requireCustomer(req: Request, res: Response, next: NextFunction): Promise<void> {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  if (!session) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const user = session.user as any;
  if (!user.isActive) {
    res.status(403).json({ error: "Account is deactivated" });
    return;
  }
  if (user.role !== ROLES.CUSTOMER) {
    res.status(403).json({ error: "Customer access required" });
    return;
  }

  // Fetch portalClientId from DB (not in session by default)
  const dbUser = await prisma.user.findUnique({
    where:  { id: user.id },
    select: { portalClientId: true },
  });

  req.user = { ...user, portalClientId: dbUser?.portalClientId ?? null };
  next();
}
