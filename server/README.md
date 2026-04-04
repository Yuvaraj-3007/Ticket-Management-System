# Server — Express.js Backend

Express.js 5 + TypeScript backend for the Ticket Management System.

## Stack

| Tool | Purpose |
|:-----|:--------|
| Bun | Runtime and package manager |
| Express.js 5 | Web framework |
| TypeScript | Type safety |
| Prisma 7 | ORM and migrations (custom output path) |
| `@prisma/adapter-pg` | PostgreSQL driver adapter |
| Better Auth 1.5 | Email/password auth, database sessions |
| Helmet | HTTP security headers |
| express-rate-limit | Rate limiting |
| Zod (via `@tms/core`) | Input validation on all routes |

## Scripts

```bash
# Development (with file watching)
bun --watch src/index.ts

# Run once
bun run src/index.ts

# Generate Prisma client
bunx prisma generate

# Run migrations
bunx prisma migrate deploy

# Seed database
bun run prisma/seed.ts
```

## Project structure

```
src/
├── generated/
│   └── prisma/              # Prisma-generated client (custom output path)
├── lib/
│   ├── auth.ts              # Better Auth configuration
│   └── prisma.ts            # Prisma client with @prisma/adapter-pg
├── middleware/
│   ├── auth.ts              # requireAuth + requireAdmin middleware
│   └── webhook.ts           # requireWebhookSecret middleware
├── routes/
│   ├── users.ts             # GET/POST/PUT/PATCH /api/users
│   ├── tickets.ts           # GET/PATCH /api/tickets, GET/POST /api/tickets/:id/comments
│   └── webhooks.ts          # POST /api/webhooks/email
└── index.ts                 # Express app, rate limiting, HTTP server
prisma/
├── schema.prisma            # Database schema
├── migrations/              # SQL migration files
└── seed.ts                  # Seeds default admin user
```

## Environment variables

| Variable | Description |
|:---------|:------------|
| `PORT` | Server port (default: `4000`) |
| `DATABASE_URL` | PostgreSQL connection string |
| `BETTER_AUTH_SECRET` | Secret key (min 32 chars) |
| `BETTER_AUTH_URL` | Backend base URL (e.g. `http://localhost:4000`) |
| `CLIENT_URL` | Frontend origin for CORS (e.g. `http://localhost:5173`) |
| `NODE_ENV` | `development` or `production` |
| `TEST_BACKEND_URL` | Backend URL used by Playwright tests (e.g. `http://localhost:5001`) |
| `WEBHOOK_SECRET` | Optional secret to guard `POST /api/webhooks/*` (leave blank to disable) |
| `ADMIN_EMAIL` | Seed admin email |
| `ADMIN_PASSWORD` | Seed admin password |
| `MOONSHOT_API_KEY` | Kimi (Moonshot) AI API key — required for `POST /api/tickets/:id/polish`. Obtain from https://platform.moonshot.ai |

Copy `.env.example` to `.env` to get started.

## API routes

| Method | Path | Auth | Description |
|:-------|:-----|:-----|:------------|
| `GET` | `/api/health` | None | Health check |
| `POST` | `/api/auth/sign-in/email` | None | Login |
| `POST` | `/api/auth/sign-out` | Session | Logout |
| `GET` | `/api/auth/get-session` | None | Current session |
| `GET` | `/api/users` | Admin | List all users |
| `POST` | `/api/users` | Admin | Create user |
| `PUT` | `/api/users/:id` | Admin | Update user |
| `PATCH` | `/api/users/:id/status` | Admin | Toggle active status |
| `GET` | `/api/tickets` | Session | List tickets (sort/filter/paginate via query params) |
| `GET` | `/api/tickets/:id` | Session | Get single ticket by ticketId (e.g. `TKT-0001`) |
| `GET` | `/api/tickets/assignable-users` | Session | Active users available for assignment |
| `PATCH` | `/api/tickets/:id/assignee` | Session | Assign or unassign a ticket |
| `PATCH` | `/api/tickets/:id/status` | Session | Update ticket status |
| `PATCH` | `/api/tickets/:id/type` | Session | Update ticket category/type |
| `GET` | `/api/tickets/:id/comments` | Session | List all comments for a ticket |
| `POST` | `/api/tickets/:id/comments` | Session | Add a comment to a ticket |
| `POST` | `/api/tickets/:id/polish` | Session | AI-improve a draft reply (requires auth, 10 req/min per user) |
| `POST` | `/api/webhooks/email` | Optional secret | Create ticket from inbound email payload |

## Security notes

- **Polish endpoint rate limit**: `POST /api/tickets/:id/polish` is subject to a per-user rate limit of 10 requests per minute, keyed by user ID, to prevent abuse of the external Moonshot AI API.
- **senderType**: The `senderType` field on comments is derived server-side from the authenticated user's session role. It is never accepted from client input.
- **Session invalidation**: Sessions are invalidated on password reset, ensuring old tokens cannot be reused after a credential change.
- **MOONSHOT_API_KEY startup guard**: The server will refuse to start in production if `MOONSHOT_API_KEY` is not set, preventing silent failures on the polish endpoint.

## Notes

- Auth routes (`/api/auth/*`) are handled by Better Auth directly via `http.createServer` — they bypass Express middleware entirely.
- Prisma client is generated to `src/generated/prisma/` (not the default `@prisma/client` path). Always import from `"../generated/prisma/client.js"`.
- Rate limiting: 500 req/15min in development, 100 req/15min in production.
