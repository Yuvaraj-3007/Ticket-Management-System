import { randomBytes, scrypt } from "node:crypto";
import { promisify } from "node:util";
import { ROLES } from "@tms/core";
import prisma from "../src/lib/prisma.js";

const scryptAsync = promisify(scrypt);

// Matches better-auth's hashPassword format: "<hex-salt>:<hex-key>"
// Uses the same scrypt params as better-auth (N=16384, r=16, p=1, dkLen=64)
async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const key = (await scryptAsync(password.normalize("NFKC"), salt, 64, {
    N: 16384,
    r: 16,
    p: 1,
    maxmem: 128 * 16384 * 16 * 2,
  })) as Buffer;
  return `${salt}:${key.toString("hex")}`;
}

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.error("ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env");
    process.exit(1);
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });

  if (existingUser) {
    // Always sync the password from ADMIN_PASSWORD env var so a redeploy
    // with a new password takes effect without manual DB intervention.
    const hashedPassword = await hashPassword(password);
    await prisma.account.updateMany({
      where: { userId: existingUser.id, providerId: "credential" },
      data: { password: hashedPassword },
    });
    console.log("Admin user already exists, password synced from ADMIN_PASSWORD.");
  } else {
    const hashedPassword = await hashPassword(password);
    const userId = crypto.randomUUID();

    await prisma.user.create({
      data: {
        id: userId,
        name: "Admin",
        email,
        role: ROLES.ADMIN,
        emailVerified: true,
        isActive: true,
      },
    });

    await prisma.account.create({
      data: {
        id: crypto.randomUUID(),
        userId,
        accountId: userId,
        providerId: "credential",
        password: hashedPassword,
      },
    });

    console.log("Admin user created (role: ADMIN)");
  }

  // AI agent — used as the assignee for auto-resolution attempts
  const AI_AGENT_EMAIL = "ai@system.internal";
  const existingAiAgent = await prisma.user.findUnique({ where: { email: AI_AGENT_EMAIL } });
  if (!existingAiAgent) {
    await prisma.user.create({
      data: {
        id: crypto.randomUUID(),
        name: "AI",
        email: AI_AGENT_EMAIL,
        role: ROLES.AGENT,
        emailVerified: true,
        isActive: true,
      },
    });
    console.log("AI agent created (role: AGENT)");
  } else {
    console.log("AI agent already exists, skipping.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
