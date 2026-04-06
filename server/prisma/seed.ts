import { hashPassword } from "better-auth/crypto";
import prisma from "../src/lib/prisma.js";

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.error("ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env");
    process.exit(1);
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });

  if (existingUser) {
    console.log("Admin user already exists, skipping seed.");
  } else {
    const hashedPassword = await hashPassword(password);
    const userId = crypto.randomUUID();

    await prisma.user.create({
      data: {
        id: userId,
        name: "Admin",
        email,
        role: "ADMIN",
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
        role: "AGENT",
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
