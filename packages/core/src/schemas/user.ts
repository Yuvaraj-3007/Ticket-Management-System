import { z } from "zod";

// ──────────────────────────────────────
// Constants
// ──────────────────────────────────────

export const USER_ROLES = ["ADMIN", "AGENT"] as const;
export type UserRole = (typeof USER_ROLES)[number];

// ──────────────────────────────────────
// API response schema
// Used by the client to validate data returned from GET /api/users
// ──────────────────────────────────────

export const apiUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  role: z.enum(USER_ROLES),
  isActive: z.boolean(),
  createdAt: z.string(),
});

export const apiUsersSchema = z.array(apiUserSchema);
export type ApiUser = z.infer<typeof apiUserSchema>;

// ──────────────────────────────────────
// Base schema — fields shared by create and edit
// ──────────────────────────────────────

const userBaseSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(128, "Name must be 128 characters or fewer"),
  email: z
    .string()
    .min(1, "Email is required")
    .email("Enter a valid email"),
  role: z.enum(USER_ROLES),
});

// ──────────────────────────────────────
// Create user schema
// Used by the client form and server route (POST /api/users)
// ──────────────────────────────────────

export const createUserSchema = userBaseSchema.extend({
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must be 128 characters or fewer"),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

// ──────────────────────────────────────
// Edit user schema
// Used by the client form and server route (PUT /api/users/:id)
// Empty string password is coerced to undefined — omit to keep existing password
// ──────────────────────────────────────

export const editUserSchema = userBaseSchema.extend({
  password: z.preprocess(
    (val) => (val === "" ? undefined : val),
    z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(128, "Password must be 128 characters or fewer")
      .optional()
  ),
});

export type EditUserInput = z.infer<typeof editUserSchema>;
