# @tms/core — Shared Schema Guide

This package is the single source of truth for all Zod schemas and constants shared between the client and server. Define once here; both sides import it.

## Package structure

```
packages/core/
├── src/
│   ├── index.ts              ← re-exports everything (import from "@tms/core")
│   └── schemas/
│       ├── user.ts           ← ROLES, USER_ROLES, user schemas and types
│       ├── ticket.ts         ← ticket constants, schemas, and types
│       └── comment.ts        ← comment constants, schemas, and types
├── package.json
└── tsconfig.json
```

## Current exports

### User (`schemas/user.ts`)

| Export | Type | Description |
|:-------|:-----|:------------|
| `USER_ROLES` | `const` tuple | `["ADMIN", "AGENT"]` — all valid roles |
| `ROLES` | `const` object | `{ ADMIN: "ADMIN", AGENT: "AGENT" }` — use instead of string literals |
| `UserRole` | `type` | `"ADMIN" \| "AGENT"` |
| `apiUserSchema` | Zod schema | Validates user objects returned from `GET /api/users` |
| `apiUsersSchema` | Zod schema | Array of `apiUserSchema` |
| `ApiUser` | `type` | Inferred from `apiUserSchema` |
| `createUserSchema` | Zod schema | Validates `POST /api/users` body and the create user form |
| `CreateUserInput` | `type` | Inferred from `createUserSchema` |
| `editUserSchema` | Zod schema | Validates `PUT /api/users/:id` body and the edit user form |
| `EditUserInput` | `type` | Inferred from `editUserSchema` |

### Ticket (`schemas/ticket.ts`)

| Export | Type | Description |
|:-------|:-----|:------------|
| `TICKET_TYPES` | `const` tuple | `["BUG","REQUIREMENT","TASK","SUPPORT"]` |
| `PRIORITIES` | `const` tuple | `["LOW","MEDIUM","HIGH","CRITICAL"]` |
| `STATUSES` | `const` tuple | `["OPEN","IN_PROGRESS","RESOLVED","CLOSED"]` |
| `TICKET_TYPE` | `const` object | Named constants — use instead of string literals |
| `PRIORITY` | `const` object | Named constants — use instead of string literals |
| `STATUS` | `const` object | Named constants — use instead of string literals |
| `TicketTypeValue` | `type` | `"BUG" \| "REQUIREMENT" \| "TASK" \| "SUPPORT"` |
| `PriorityValue` | `type` | `"LOW" \| "MEDIUM" \| "HIGH" \| "CRITICAL"` |
| `StatusValue` | `type` | `"OPEN" \| "IN_PROGRESS" \| "RESOLVED" \| "CLOSED"` |
| `apiTicketSchema` | Zod schema | Validates ticket objects from `GET /api/tickets` and `GET /api/tickets/:id` |
| `apiTicketsSchema` | Zod schema | Array of `apiTicketSchema` |
| `ApiTicket` | `type` | Inferred from `apiTicketSchema` |
| `SORTABLE_COLUMNS` | `const` tuple | Columns allowed in `sortBy` query param |
| `ticketSortSchema` | Zod schema | Validates `sortBy` + `sortOrder` query params |
| `ticketFilterSchema` | Zod schema | Validates `search`, `status`, `priority`, `type` query params |
| `paginationSchema` | Zod schema | Validates `page` + `pageSize` query params (coerced from strings) |
| `ticketQuerySchema` | Zod schema | Merged sort + filter + pagination schema for `GET /api/tickets` |
| `TicketQuery` | `type` | Inferred from `ticketQuerySchema` |
| `paginatedTicketsSchema` | Zod schema | Validates paginated list response `{ data, total, page, pageSize, totalPages }` |
| `PaginatedTickets` | `type` | Inferred from `paginatedTicketsSchema` |
| `inboundEmailSchema` | Zod schema | Validates `POST /api/webhooks/email` body |
| `InboundEmail` | `type` | Inferred from `inboundEmailSchema` |
| `assignTicketSchema` | Zod schema | Validates `PATCH /api/tickets/:id/assignee` body (assignedToId: uuid or null) |
| `AssignableUser` | `type` | `{ id: string; name: string }` |
| `assignableUsersSchema` | Zod schema | Array of `AssignableUser` from `GET /api/tickets/assignable-users` |
| `updateStatusSchema` | Zod schema | Validates `PATCH /api/tickets/:id/status` body |
| `updateTypeSchema` | Zod schema | Validates `PATCH /api/tickets/:id/type` body |

### Comment (`schemas/comment.ts`)

| Export | Type | Description |
|:-------|:-----|:------------|
| `COMMENT_SENDER_TYPES` | `const` tuple | `["AGENT", "CUSTOMER"]` |
| `CommentSenderType` | `type` | `"AGENT" \| "CUSTOMER"` |
| `apiCommentSchema` | Zod schema | Validates comment objects from `GET /api/tickets/:id/comments` |
| `apiCommentsSchema` | Zod schema | Array of `apiCommentSchema` |
| `ApiComment` | `type` | Inferred from `apiCommentSchema` |
| `createCommentSchema` | Zod schema | Validates `POST /api/tickets/:id/comments` body (content 1–5000 chars); senderType is derived server-side from the authenticated user's role and is not accepted from the client |
| `CreateCommentInput` | `type` | Inferred from `createCommentSchema` |
| `polishReplySchema` | Zod schema | Validates `POST /api/tickets/:id/polish` request body |
| `PolishReplyInput` | `type` | TypeScript type for polish input |

## Using ROLES (important)

Never use `"ADMIN"` or `"AGENT"` as raw string literals. Always use `ROLES`:

```ts
import { ROLES } from "@tms/core";

// ✅ correct
if (user.role === ROLES.ADMIN) { ... }
defaultValues: { role: ROLES.AGENT }

// ❌ wrong
if (user.role === "ADMIN") { ... }
defaultValues: { role: "AGENT" }
```

See [CLAUDE.md](../../CLAUDE.md) for the full rule including the `vi.mock` hoisting exception.

## Adding a new schema

### 1. Create or edit a file under `src/schemas/`

Group schemas by domain (e.g., `ticket.ts`, `comment.ts`).

```ts
// packages/core/src/schemas/ticket.ts
import { z } from "zod";

export const TICKET_STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const;
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
  const parsed = createTicketSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ fieldErrors: parsed.error.flatten().fieldErrors });
    return;
  }
  const data: CreateTicketInput = parsed.data;
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
- Keep constants (e.g., `USER_ROLES`, `ROLES`) in the same file as the schemas that reference them and export them so both sides can use them.
- Use `.safeParse()` on the server for controlled error responses; use `zodResolver()` on the client for React Hook Form integration.
