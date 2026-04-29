import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_API_URL || (typeof window !== "undefined" ? window.location.origin : "http://localhost:5173"),
  basePath: "/api/auth",
});

export const { useSession, signIn, signOut, resetPassword } = authClient;
export const requestPasswordReset = authClient.requestPasswordReset;
