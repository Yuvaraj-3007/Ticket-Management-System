# Implementation Plan: Basic Ticket Management System

---

## Phase 1: Project Setup & Database

> Get the foundation running — project structure, database, and dev environment.

| #   | Task                                                        | Status |
| --- | ----------------------------------------------------------- | ------ |
| 1.1 | Initialize monorepo folder structure (`/client`, `/server`) | [x]    |
| 1.2 | Setup Node.js + Express.js backend with Bun                 | [x]    |
| 1.3 | Setup React.js frontend with Vite + Tailwind CSS            | [x]    |
| 1.4 | Install and configure Prisma v7 with PostgreSQL adapter     | [x]    |
| 1.5 | Design database schema (users, tickets, comments, history)  | [x]    |
| 1.6 | Create Prisma schema file and run first migration           | [x]    |
| 1.7 | Seed database with default Admin user                       | [x]    |
| 1.8 | Setup Docker Compose for local dev (app + PostgreSQL)       | [ ]    |

**Deliverable:** Backend and frontend running locally, database tables created.

---

## Phase 2: Authentication

> Login, logout, session management, and route protection.

| #    | Task                                                              | Status |
| ---- | ----------------------------------------------------------------- | ------ |
| 2.1  | Install and configure Better Auth with Prisma adapter             | [x]    |
| 2.2  | Configure email/password auth (signup disabled)                   | [x]    |
| 2.3  | Better Auth handles login (`POST /api/auth/sign-in/email`)        | [x]    |
| 2.4  | Better Auth handles logout (`POST /api/auth/sign-out`)            | [x]    |
| 2.5  | Better Auth handles session (`GET /api/auth/get-session`)         | [x]    |
| 2.6  | Add requireAuth middleware to protect routes                      | [x]    |
| 2.7  | Add requireAdmin middleware (Admin vs Agent)                      | [x]    |
| 2.8  | Build Login page (react-hook-form + zod + shadcn/ui)              | [x]    |
| 2.9  | Setup React Router with ProtectedRoute + GuestRoute + AdminRoute  | [x]    |
| 2.10 | Handle auth state via Better Auth useSession hook                 | [x]    |

**Deliverable:** Users can log in, sessions are stored in DB, protected routes work.

---

## Phase 3: User Management (Admin)

> Admin can create and manage team members.

| #   | Task                                                              | Status |
| --- | ----------------------------------------------------------------- | ------ |
| 3.1 | Build create user API (`POST /api/users`)                         | [x]    |
| 3.2 | Build list users API (`GET /api/users`)                           | [x]    |
| 3.3 | Build update user API (`PUT /api/users/:id`)                      | [x]    |
| 3.4 | Build deactivate/reactivate user API (`PATCH /api/users/:id/status`) | [x] |
| 3.5 | Build User Management page (frontend) — table + add/edit dialog  | [x]    |
| 3.6 | Restrict user management pages to Admin role only                 | [x]    |

**Deliverable:** Admin can add, edit, deactivate, and reactivate users from the UI.

---

## Phase 4: Ticket CRUD

> Core ticket operations — create, read, update.

| #    | Task                                                              | Status |
| ---- | ----------------------------------------------------------------- | ------ |
| 4.1  | Build create ticket API (`POST /api/tickets`)                     | [ ]    |
| 4.2  | Auto-generate ticket ID (TKT-0001 format)                        | [x]    |
| 4.3  | Build get all tickets API (`GET /api/tickets`) with filters       | [x]    |
| 4.4  | Build get single ticket API (`GET /api/tickets/:id`)              | [x]    |
| 4.5  | Build update ticket API (`PUT /api/tickets/:id`)                  | [ ]    |
| 4.6  | Build update ticket status API (`PATCH /api/tickets/:id/status`)  | [x]    |
| 4.7  | File upload for attachments (`POST /api/tickets/:id/attachments`) | [ ]    |
| 4.8  | Build Create Ticket page (frontend) — form with all fields       | [ ]    |
| 4.9  | Build Ticket List page (frontend) — table with filters & search  | [x]    |
| 4.10 | Build Ticket Detail page (frontend) — full view + status change  | [x]    |
| 4.11 | Build assign ticket API (`PATCH /api/tickets/:id/assignee`) + UI  | [x]    |
| 4.12 | Build update category API (`PATCH /api/tickets/:id/type`) + UI   | [x]    |

**Deliverable:** Users can create, view, filter, search, and update tickets.

---

## Phase 5: Comments & History

> Add collaboration and audit trail to tickets.

| #   | Task                                                              | Status |
| --- | ----------------------------------------------------------------- | ------ |
| 5.1 | Build add comment API (`POST /api/tickets/:id/comments`)          | [x]    |
| 5.2 | Build list comments API (`GET /api/tickets/:id/comments`)         | [x]    |
| 5.3 | Log ticket changes to history table (status, assignment, edits)   | [ ]    |
| 5.4 | Build get history API (`GET /api/tickets/:id/history`)            | [ ]    |
| 5.5 | Add comments section to Ticket Detail page (frontend)             | [x]    |
| 5.6 | Add history/activity tab to Ticket Detail page (frontend)         | [ ]    |
| 5.7 | `senderType` derived from session server-side (webhook→CUSTOMER, agent→AGENT) | [x] |
| 5.8 | AI Polish button — `POST /api/tickets/:id/polish` rewrites draft via Kimi/Moonshot API | [x] |

**Deliverable:** Team can discuss on tickets. Every change is logged and visible.

---

## Phase 6: Dashboard & My Tickets

> Overview and personal views.

| #   | Task                                                           | Status |
| --- | -------------------------------------------------------------- | ------ |
| 6.1 | Build dashboard stats API (`GET /api/dashboard/stats`)         | [ ]    |
| 6.2 | Build recent tickets API (`GET /api/dashboard/recent`)         | [ ]    |
| 6.3 | Build Dashboard page (frontend) — status counts + recent list  | [ ]    |
| 6.4 | Build My Tickets page (frontend) — assigned tickets + filters  | [ ]    |
| 6.5 | Add sidebar/navbar navigation across all pages                 | [ ]    |

**Deliverable:** Users see a summary on login. Agents see their own workload.

---

## Phase 7: Polish & Deployment

> Final cleanup, testing, and Docker deployment.

| #    | Task                                                       | Status |
| ---- | ---------------------------------------------------------- | ------ |
| 7.1  | Add form validations (frontend + backend)                  | [x]    |
| 7.2  | Add error handling and user-friendly error messages        | [x]    |
| 7.3  | Add loading states and empty states across all pages       | [x]    |
| 7.4  | Make all pages mobile responsive                           | [ ]    |
| 7.5  | Write Dockerfile for backend                               | [ ]    |
| 7.6  | Write Dockerfile for frontend                              | [ ]    |
| 7.7  | Update Docker Compose for production (app + DB)            | [ ]    |
| 7.8  | Configure Coolify deployment                               | [ ]    |
| 7.9  | Test full flow end-to-end                                  | [x]    |
| 7.10 | AI Polish button (Kimi/Moonshot API) with rate limiting    | [x]    |
| 7.11 | Security audit — all Critical/High/Medium/Low issues fixed | [x]    |
| 7.12 | `server/.env.example` created with all required variables  | [x]    |

**Deliverable:** System is live, containerized, and deployed via Coolify.

---

## Summary

| Phase | What                      | Tasks | Done | Status      |
| ----- | ------------------------- | ----- | ---- | ----------- |
| 1     | Project Setup & Database  | 8     | 7    | 87% Done    |
| 2     | Authentication            | 10    | 10   | Complete    |
| 3     | User Management           | 6     | 6    | Complete    |
| 4     | Ticket CRUD               | 12    | 8    | In Progress |
| 5     | Comments & History        | 8     | 5    | In Progress |
| 6     | Dashboard & My Tickets    | 5     | 0    | Not Started |
| 7     | Polish & Deployment       | 12    | 7    | In Progress |
| **Total** |                       | **61** | **43** | **70% Complete** |

### Additional Completed (not in original plan)

- `@tms/core` shared workspace package — Zod schemas and ROLES/ticket constants shared between client and server
- Email webhook endpoint (`POST /api/webhooks/email`) — creates tickets from inbound email payloads with auto-generated IDs
- Ticket list: server-side sorting (Prisma `orderBy`), filtering (search + status/priority/type), and pagination (`skip`/`take` + count)
- TanStack Table v8 in client with `manualSorting` and `manualPagination` modes
- Shared badge helpers (`src/lib/ticket-badges.ts`) — label and variant maps used by both list and detail pages
- Playwright E2E test suite — 158 tests across auth, user management, webhooks, tickets, ticket detail, and AI polish
- Vitest unit tests — 128 tests across TicketDetail, TicketReplies, Users, create user form, TicketDetailPage, and Tickets page
- `senderType` field on Comment model (`CommentSenderType` enum: AGENT | CUSTOMER)
- Server-side `senderType` derivation — clients cannot forge sender identity
- `EnumSelect` reusable component for enum dropdowns
- `TicketReplies` self-contained reply thread component with Agent/Customer sender type and AI Polish button
- `GET /api/tickets/assignable-users` — list active assignable users
- `POST /api/tickets/:id/polish` — AI-powered reply polishing via Kimi/Moonshot API
- Inline assignee, status, and category editing on Ticket Detail page
- Global JSON error handler middleware (fixes HTML 400/500 responses)
- React Compiler compatibility fixes (useWatch instead of form.watch)
- CLAUDE.md coding guidelines
- `server/.env.example` with all required environment variables

---

## Security Audit

**Completed: 2026-04-04** — All identified issues resolved.

| Severity | Issue | Resolution |
|:---------|:------|:-----------|
| High | AI endpoint lacked per-user rate limiting | Added 10 req/min per-user rate limit on `POST /api/tickets/:id/polish` |
| High | `senderType` was client-supplied | Moved to server-side derivation from session/webhook context |
| High | Password reset did not invalidate sessions | Session invalidation added on `PUT /api/users/:id` password change |
| Medium | Prompt injection possible via reply content | Structural delimiters added to separate system prompt from user content |
| Medium | Missing production startup guard for AI key | Server exits on startup if `MOONSHOT_API_KEY` is absent in production |
| Low | AI SDK errors logged verbatim | Safe error logging added — only message and status code are surfaced |
