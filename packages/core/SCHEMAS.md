# @tms/core — Shared Schema Guide

This package is the single source of truth for all Zod schemas shared between the client and server. Define a schema once here; both sides import it.

## Package structure

```
packages/core/
├── src/
│   ├── index.ts          ← re-exports everything (import from "@tms/core")
│   └── schemas/
│       └── user.ts       ← user schemas and types
├── package.json
└── tsconfig.json
```

## Adding a new schema

### 1. Create or edit a file under `src/schemas/`

Group schemas by domain (e.g., `ticket.ts`, `comment.ts`).

```ts
// packages/core/src/schemas/ticket.ts
import { z } from "zod";

export const TICKET_STATUSES = ["OPEN", "IN_PROGRESS", "CLOSED"] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const createTicketSchema = z.object({
  title: z.string().min(1, "Title is required").max(255),
  description: z.string().max(5000).optional(),
  status: z.enum(TICKET_STATUSES).default("OPEN"),
});

export type CreateTicketInput = z.infer<typeof createTicketSchema>;
```

### 2. Re-export from `src/index.ts`

```ts
export * from "./schemas/ticket.js";
```

### 3. Use in the server

```ts
import { createTicketSchema, type CreateTicketInput } from "@tms/core";

router.post("/", async (req, res) => {
  const result = createTicketSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ errors: result.error.flatten().fieldErrors });
    return;
  }
  const data: CreateTicketInput = result.data;
  // ...
});
```

### 4. Use in the client

```ts
import { createTicketSchema, type CreateTicketInput } from "@tms/core";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

const form = useForm<CreateTicketInput>({
  resolver: zodResolver(createTicketSchema),
  defaultValues: { title: "", status: "OPEN" },
});
```

## Rules

- **Never** duplicate a schema. If a shape already exists in `@tms/core`, import it — don't redefine it locally.
- **API response schemas** (e.g., `apiUserSchema`) validate data received from the server. Use them in client query functions.
- **Input schemas** (e.g., `createUserSchema`, `editUserSchema`) validate user-submitted data. Use them on both the client form and the server route.
- Keep constants (e.g., `USER_ROLES`) in the same file as the schemas that reference them and export them so both sides can use them.
- Use `.safeParse()` on the server for controlled error responses; use `zodResolver()` on the client for React Hook Form integration.
