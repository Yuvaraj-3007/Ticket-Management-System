import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { ROLES } from "@tms/core";
import prisma from "./prisma.js";

const isProd = process.env.NODE_ENV === "production";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    disableSignUp: true,
    sendResetPassword: async ({ user, url }) => {
      const { sendPasswordResetEmail } = await import("./mailer.js");
      await sendPasswordResetEmail({
        to:       user.email,
        name:     user.name,
        resetUrl: url,
      });
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24,     // refresh daily
  },
  rateLimit: {
    enabled: process.env.NODE_ENV !== "test",  // enforce in dev too — disabled only in test
    window: 60,       // 1 minute window
    max: 10,          // max 10 attempts per window
    storage: "memory",
  },
  advanced: {
    cookies: {
      session_token: {
        attributes: {
          httpOnly: true,
          secure: isProd,
          sameSite: "lax",
        },
      },
    },
  },
  secret: process.env.BETTER_AUTH_SECRET,
  basePath: "/api/auth",
  baseURL: process.env.BETTER_AUTH_URL,
  trustedOrigins: [process.env.CLIENT_URL || "http://localhost:5173"],
  user: {
    additionalFields: {
      role: {
        type: "string",
        defaultValue: ROLES.AGENT,
        input: false,
      },
      isActive: {
        type: "boolean",
        defaultValue: true,
        input: false,
      },
    },
  },
});
