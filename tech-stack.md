# Tech Stack

## Runtime

- **Bun** — JavaScript/TypeScript runtime and package manager (monorepo workspaces)

## Frontend

- **React.js** (v19) — UI framework
- **TypeScript** (v5.9) — type safety
- **Tailwind CSS** (v4) — utility-first styling
- **shadcn/ui** — component library built on `@base-ui/react` (Button, Card, Input, Label, Badge, Dialog, Select, Table, Skeleton)
- **React Router DOM** (v7) — client-side routing with ProtectedRoute, AdminRoute, GuestRoute
- **TanStack Query** (v5) — server state, caching, mutations
- **TanStack Table** (v8) — headless table with `manualSorting` and `manualPagination`
- **React Hook Form** (v7) — form state management
- **Zod** (v4) — schema validation
- **Vite** (v8) — build tool and dev server

## Backend

- **Express.js** (v5) — web framework with automatic async error handling
- **TypeScript** — type safety
- **Helmet** — security headers middleware
- **express-rate-limit** — rate limiting (500 req/15min dev, 100 req/15min prod)
- **CORS** — restricted to `CLIENT_URL`
- **dotenv** — environment variable loading

## Shared

- **`@tms/core`** — internal workspace package
  - User schemas: `createUserSchema`, `editUserSchema`, `apiUserSchema`
  - Ticket schemas: `apiTicketSchema`, `paginatedTicketsSchema`, `ticketQuerySchema`, `inboundEmailSchema`, `assignTicketSchema`, `updateStatusSchema`, `updateTypeSchema`
  - Comment schemas: `apiCommentSchema`, `createCommentSchema`
  - Constants: `ROLES`, `USER_ROLES`, `TICKET_TYPE`, `PRIORITY`, `STATUS`, `TICKET_TYPES`, `PRIORITIES`, `STATUSES`, `SORTABLE_COLUMNS`, `COMMENT_SENDER_TYPES`
  - Types: `UserRole`, `ApiUser`, `ApiTicket`, `PaginatedTickets`, `TicketTypeValue`, `PriorityValue`, `StatusValue`, `ApiComment`, `CreateCommentInput`, `CommentSenderType`, `AssignableUser`

## Database

- **PostgreSQL** (v17, port 5433) — primary database
- **Prisma** (v7) — ORM and database migrations with custom output path
- **`@prisma/adapter-pg`** — PostgreSQL driver adapter for Prisma v7
- **`pg`** — PostgreSQL client (connection pool)

## Authentication

- **Better Auth** (v1.5) — email/password auth with database sessions
  - Sign-up disabled (admin creates users only)
  - Session-based (7-day expiry, daily refresh)
  - Credentials stored on `Account` model (separate from `User`)
  - Auth routes bypass Express middleware via `http.createServer`

## Security

- **Helmet** — HTTP security headers (CSP, X-Frame-Options, HSTS, etc.)
- **Rate Limiting** — `express-rate-limit` on all `/api` routes
- **CORS** — restricted to client origin via `CLIENT_URL` env var
- **Body Size Limit** — 50kb max request body
- **Zod validation** — all API inputs validated with `safeParse` on server
- **Atomic user creation** — `prisma.$transaction` for user + account creation
- **Password hashing** — `better-auth/crypto` `hashPassword`
- **Global JSON error handler** — all Express errors returned as JSON (no HTML pages)
- **Per-user AI rate limiting** — 10 req/min on the polish endpoint, keyed by user ID
- **Server-side senderType derivation** — clients cannot forge the comment sender type
- **Session invalidation on password reset** — all existing sessions revoked on password change
- **Prompt injection mitigation** — structural delimiters used in system prompt to isolate user content
- **Safe error logging** — `err.message` only; no SDK internals leaked to logs or responses
- **MOONSHOT_API_KEY startup guard** — server refuses to start in production if the key is missing

## AI / External APIs

- **Kimi (Moonshot AI)** — `moonshot-v1-8k` model via OpenAI-compatible API (`https://api.moonshot.ai/v1`)
- **Vercel AI SDK** (`ai` + `@ai-sdk/openai-compatible`) — used for structured LLM calls from the server
- Used for: AI-powered reply polishing on POST /api/tickets/:id/polish

## Testing

### Unit Tests

- **Vitest** (v4) — test runner
- **@testing-library/react** (v16) — component rendering
- **@testing-library/user-event** (v14) — user interaction simulation
- **@testing-library/jest-dom** (v6) — DOM matchers
- **jsdom** — browser environment for tests
- 128 tests covering Users form, TicketDetail component, TicketReplies component, Tickets page, and TicketDetailPage

### E2E Tests

- **Playwright** — end-to-end browser testing (Chromium)
- Separate test database (`ticket_management_test`)
- Global setup: migrations + admin seed before each run
- Global teardown: all tables truncated after tests complete
- 158 tests across authentication (46), user management (5), webhooks (28), tickets (21), ticket detail (52), smoke (1)
- Backend on port 5001, Frontend on port 5175
- `TEST_BACKEND_URL` in `server/.env` must point to the test backend port (5001) for UI tests to resolve correctly

### Git Hooks

- **Lefthook** — git hooks manager
  - `pre-commit`: ESLint + TypeScript check (client + server) run in parallel
  - `pre-push`: Vitest unit tests + Playwright E2E tests run in sequence
  - Blocks commits/pushes on any failure

## Deployment (Planned)

- **Docker** — containerized application
- **Coolify** — self-hosted deployment platform
