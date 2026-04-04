# Ticket Management System

A centralized ticket management system for tracking support requests, bugs, and tasks across teams.

![React](https://img.shields.io/badge/React-19-blue?logo=react)
![Express.js](https://img.shields.io/badge/Express.js-5-black?logo=express)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?logo=typescript)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-blue?logo=postgresql)
![Prisma](https://img.shields.io/badge/Prisma-7-2D3748?logo=prisma)
![E2E Tests](https://img.shields.io/badge/Playwright-158_tests-green?logo=playwright)
![Unit Tests](https://img.shields.io/badge/Vitest-128_tests-green?logo=vitest)
![License](https://img.shields.io/badge/License-Proprietary-red)

---

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Quick Start](#quick-start)
- [Demo Credentials](#demo-credentials)
- [API Endpoints](#api-endpoints)
- [Database Schema](#database-schema)
- [Security](#security)
- [Testing](#testing)
- [Git Hooks (Lefthook)](#git-hooks-lefthook)
- [Development](#development)
- [License](#license)

---

## Overview

Ticket Management System is a full-stack application designed to replace fragmented ticket intake (email, chat, spreadsheets) with a single, centralized platform. Built with a React frontend and Express.js backend, it provides role-based access control, real-time dashboard metrics, and a complete audit trail for every ticket change.

---

## Key Features

- **Authentication** — Email/password login with database-backed sessions (sign-up disabled, admin creates users)
- **Role-Based Access Control** — Admin and Agent roles with route-level protection
- **User Management** — Admin can create, edit, deactivate, and reactivate team members
- **Ticket Intake** — Auto-create tickets from inbound email via webhook (`POST /api/webhooks/email`) with auto-generated IDs (TKT-0001 format)
- **Ticket List** — Paginated, sortable, and filterable ticket table with search
- **Ticket Detail** — Inline editing of status, category, and assignee directly on the detail page
- **Reply Thread** — Comments on tickets with Agent/Customer sender type distinction
- **AI-powered reply polishing** — Kimi/Moonshot API rewrites agent replies for clarity and professionalism
- **Security** — Helmet headers, CORS restrictions, rate limiting, Zod input validation, prompt injection mitigation
- **Shared Schemas** — `@tms/core` workspace package shares Zod schemas and constants between client and server

---

## Tech Stack

| Layer | Technology |
|:------|:-----------|
| **Runtime** | Bun |
| **Frontend** | React 19, TypeScript, Vite 8, Tailwind CSS 4, shadcn/ui (Base UI) |
| **State / Data** | TanStack Query v5 |
| **Routing** | React Router DOM 7 |
| **Forms** | React Hook Form 7 + Zod 4 |
| **Backend** | Express.js 5, TypeScript |
| **Database** | PostgreSQL 17 |
| **ORM** | Prisma 7 with `@prisma/adapter-pg` |
| **Auth** | Better Auth 1.5 (email/password, database sessions) |
| **Security** | Helmet, express-rate-limit, CORS |
| **Tables** | TanStack Table v8 (manualSorting + manualPagination) |
| **Shared** | `@tms/core` workspace package (Zod schemas, ROLES/ticket constants) |
| **Unit Tests** | Vitest 4 + Testing Library |
| **E2E Tests** | Playwright |

---

## Architecture

```
Browser (React SPA)
    |
    |-- Vite Dev Server (port 5173)
    |       |
    |       |-- /api/* proxy -->  Express.js (port 4000)
    |                                  |
    |                                  |-- Better Auth (sessions)
    |                                  |-- Prisma ORM
    |                                  |       |
    |                                  |       |-- PostgreSQL (port 5433)
    |                                  |
    |                                  |-- Middleware
    |                                       |-- requireAuth
    |                                       |-- requireAdmin
    |                                       |-- Helmet + Rate Limiting

packages/core (@tms/core)
    |-- Shared Zod schemas (user + ticket)
    |-- ROLES, TICKET_TYPE, PRIORITY, STATUS constants
    |-- TypeScript types
    (imported by both client and server)
```

---

## Project Structure

```
Ticket-Management-System/
├── client/                        # React frontend
│   ├── src/
│   │   ├── components/            # Navbar, TicketDetail, TicketReplies, EnumSelect, ui/ (textarea, ...)
│   │   │   └── __tests__/         # TicketDetail.test.tsx, TicketReplies.test.tsx
│   │   ├── pages/                 # Login, Dashboard, Users, Tickets, TicketDetailPage
│   │   │   └── __tests__/         # Vitest unit tests (128 tests)
│   │   └── lib/                   # Auth client, ticket-badges, utilities
│   ├── vite.config.ts             # Vite + Vitest config
│   └── package.json
├── server/                        # Express.js backend
│   ├── src/
│   │   ├── routes/                # users.ts, tickets.ts, webhooks.ts
│   │   ├── lib/                   # Auth config, Prisma client
│   │   └── middleware/            # Auth & admin middleware
│   ├── prisma/
│   │   ├── schema.prisma          # Database schema
│   │   ├── migrations/            # SQL migrations
│   │   └── seed.ts                # Default admin seed
│   ├── .env.example
│   └── package.json
├── packages/
│   └── core/                      # @tms/core shared package
│       ├── src/
│       │   ├── index.ts           # Re-exports everything
│       │   └── schemas/
│       │       ├── user.ts        # ROLES, user schemas/types
│       │       └── ticket.ts      # ticket constants, schemas, types
│       └── SCHEMAS.md             # How to add new schemas
├── tests/                         # Playwright e2e tests
│   ├── auth.spec.ts               # Authentication tests (46 tests)
│   ├── users.spec.ts              # User management tests (9 tests)
│   ├── webhooks.spec.ts           # Webhook intake tests (28 tests)
│   ├── tickets.spec.ts            # Tickets list/API tests (21 tests)
│   ├── ticket-detail.spec.ts      # Ticket detail page tests (69 tests)
│   ├── example.spec.ts            # Smoke test (1 test)
│   ├── global-setup.ts            # Test DB migration & seed
│   └── global-teardown.ts         # Test DB cleanup
├── CLAUDE.md                      # Coding guidelines for AI & devs
├── playwright.config.ts
├── implementation-plan.md
├── tech-stack.md
└── package.json
```

---

## Quick Start

### Prerequisites

- [Bun](https://bun.sh/) — runtime and package manager
- [PostgreSQL 17](https://www.postgresql.org/) — running on port 5433
- [Node.js](https://nodejs.org/) — required for Playwright

### 1. Clone the repository

```bash
git clone https://github.com/Yuvaraj-3007/Ticket-Management-System.git
cd Ticket-Management-System
```

### 2. Install dependencies

```bash
bun install
```

### 3. Configure environment

```bash
cp server/.env.example server/.env
```

Edit `server/.env`:

```env
PORT=4000
DATABASE_URL=postgresql://postgres:your_password@localhost:5433/ticket_management
BETTER_AUTH_SECRET=your-secret-key-min-32-chars
BETTER_AUTH_URL=http://localhost:4000
CLIENT_URL=http://localhost:5173
NODE_ENV=development
TEST_BACKEND_URL=http://localhost:5001
WEBHOOK_SECRET=
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=YourPassword@123
MOONSHOT_API_KEY=your-moonshot-api-key
```

### 4. Set up the database

```bash
cd server
bunx prisma migrate deploy
bun run prisma/seed.ts
```

### 5. Start development servers

```bash
# Terminal 1 — Backend (port 4000)
cd server && bun run src/index.ts

# Terminal 2 — Frontend (port 5173)
cd client && bun run dev
```

Open [http://localhost:5173](http://localhost:5173) to access the application.

---

## Demo Credentials

| Role | Email | Password |
|:-----|:------|:---------|
| **Admin** | `admin@wisright.com` | `Test@123` |

> Sign-up is disabled. Only admins can create new users via the User Management page.

---

## API Endpoints

### Authentication

| Method | Endpoint | Description |
|:-------|:---------|:------------|
| `POST` | `/api/auth/sign-in/email` | Login with email/password |
| `POST` | `/api/auth/sign-out` | Logout and destroy session |
| `GET` | `/api/auth/get-session` | Get current session info |

### Users (Admin only)

| Method | Endpoint | Description |
|:-------|:---------|:------------|
| `GET` | `/api/users` | List all users |
| `POST` | `/api/users` | Create a new user |
| `PUT` | `/api/users/:id` | Update user name, email, role, password |
| `PATCH` | `/api/users/:id/status` | Activate or deactivate a user |

### Tickets

| Method | Endpoint | Description |
|:-------|:---------|:------------|
| `GET` | `/api/tickets` | List tickets (sort, filter, paginate via query params) |
| `GET` | `/api/tickets/:id` | Get a single ticket by ticketId (e.g. `TKT-0001`) |
| `GET` | `/api/tickets/assignable-users` | Active users available for assignment |
| `PATCH` | `/api/tickets/:id/assignee` | Assign or unassign a ticket |
| `PATCH` | `/api/tickets/:id/status` | Update ticket status |
| `PATCH` | `/api/tickets/:id/type` | Update ticket category/type |
| `GET` | `/api/tickets/:id/comments` | List all comments for a ticket |
| `POST` | `/api/tickets/:id/comments` | Add a comment to a ticket |
| `POST` | `/api/tickets/:id/polish` | AI-polish a draft reply (Kimi/Moonshot API, rate-limited) |

### Webhooks

| Method | Endpoint | Description |
|:-------|:---------|:------------|
| `POST` | `/api/webhooks/email` | Create a ticket from an inbound email payload |

### System

| Method | Endpoint | Description |
|:-------|:---------|:------------|
| `GET` | `/api/health` | Health check |

---

## Database Schema

### Models

| Model | Description |
|:------|:------------|
| **User** | Email, name, role (ADMIN/AGENT), active status |
| **Account** | Better Auth credential provider (hashed password) |
| **Session** | Database-backed auth sessions (7-day expiry, daily refresh) |
| **Ticket** | Title, description, type, priority, status, assignee, project |
| **Comment** | Threaded comments on tickets with author |
| **Attachment** | File attachments linked to tickets |
| **TicketHistory** | Audit trail logging every ticket change |

### Enums

| Enum | Values |
|:-----|:-------|
| **Role** | `ADMIN` `AGENT` |
| **TicketType** | `BUG` `REQUIREMENT` `TASK` `SUPPORT` |
| **Priority** | `LOW` `MEDIUM` `HIGH` `CRITICAL` |
| **Status** | `OPEN` `IN_PROGRESS` `RESOLVED` `CLOSED` |
| **CommentSenderType** | `AGENT` `CUSTOMER` |

---

## Security

A security audit was completed on 2026-04-04. All identified issues (Critical, High, Medium, Low) were resolved. Key measures in place:

| Measure | Detail |
|:--------|:-------|
| **Per-user AI rate limiting** | AI polish endpoint capped at 10 requests/minute per user |
| **Server-side senderType** | `senderType` is derived from session on the server — clients cannot forge the sender |
| **Session invalidation on password reset** | All existing sessions are destroyed when a user's password is changed |
| **Prompt injection mitigation** | Structural delimiters separate system prompt from user-supplied content |
| **MOONSHOT_API_KEY guard** | Server refuses to start in production if `MOONSHOT_API_KEY` is missing |
| **Safe error logging** | SDK/AI errors are sanitised before logging — no internal stack traces leaked to clients |
| **Helmet + CORS** | Security headers and origin restrictions on every response |
| **Input validation** | Zod schemas validate all request bodies on every endpoint |

---

## Testing

### Unit Tests (Vitest)

```bash
cd client

# Run once
npx vitest run

# Watch mode
bun run test:components:watch
```

| Suite | Tests |
|:------|:------|
| TicketDetail component | 24 |
| TicketReplies component | 27 |
| Users page rendering | 2 |
| Create user form | 10 |
| TicketDetailPage (pages) | 46 |
| Tickets page | 24 |
| **Total** | **128** |

### E2E Tests (Playwright)

```bash
# Run all tests headless
npx playwright test

# Interactive UI
npx playwright test --ui

# Specific file
npx playwright test tests/ticket-detail.spec.ts

# View HTML report
npx playwright show-report tests/playwright-report
```

#### Test Infrastructure

- **Test database:** `ticket_management_test` (isolated from dev)
- **Test servers:** Backend on port 5001, Frontend on port 5175
- **Setup:** Migrations + admin seed before each run
- **Teardown:** All tables truncated after tests complete
- **`TEST_BACKEND_URL`** in `server/.env` must point to port 5001 for e2e tests

#### E2E Coverage

> E2E tests cover only what cannot be tested with unit tests: real API calls, database persistence, browser navigation, and full user flows. Component rendering and interaction logic is covered by the 128 unit tests.

| Suite | Tests | Coverage |
|:------|:------|:---------|
| Login rendering | 4 | Form elements, field types, initial state |
| Successful login | 2 | Redirect, loading state |
| Client-side validation | 6 | Empty fields, invalid email, short password |
| Server-side errors | 4 | Wrong password, unknown email, error recovery |
| Session persistence | 2 | Reload, direct navigation |
| Logout | 5 | Redirect, form display, cookie cleanup |
| Route protection (guest) | 3 | Unauthenticated redirects |
| Route protection (auth) | 1 | Authenticated redirect from /login |
| Role-based access | 3 | Admin /users access, nav links |
| Navbar identity | 1 | User name display |
| Edge cases & security | 12 | SQL injection, XSS, long inputs, signup disabled |
| Auth API | 3 | Direct endpoint validation |
| Smoke test | 1 | App loads |
| User management | 5 | Real DB: create, update, deactivate, reactivate |
| Webhook email intake | 28 | Create ticket, field mapping, validation, auth |
| Tickets list & API | 21 | Sort, filter, paginate, auth, field validation |
| GET /api/tickets/:id API | 6 | 200/401/404, required fields |
| Ticket detail — navigation | 5 | Auth redirect, URL nav, back button, list→detail, 404 |
| GET assignable-users API | 3 | Auth, response shape |
| PATCH assignee API | 6 | Assign, unassign, 400/404 cases |
| Assign ticket — UI | 2 | Real PATCH: assign user, unassign |
| PATCH status API | 5 | Update, invalid value, 404 |
| PATCH type API | 5 | Update, invalid value, 404 |
| Update status — UI | 2 | Real PATCH + persistence check |
| Update category — UI | 2 | Real PATCH + persistence check |
| GET comments API | 5 | Auth, empty array, fields shape |
| POST comments API | 7 | Create, senderType, validation, 404 |
| Replies — UI | 3 | Full post flow, count, Customer sender flow |
| AI polish API | 4 | Auth, happy path, rate limit, validation |
| **Total** | **158** | |

---

## Git Hooks (Lefthook)

Pre-commit and pre-push hooks are enforced via [Lefthook](https://github.com/evilmartians/lefthook) to catch issues before they reach GitHub.

### On every `git commit` (runs in parallel)

| Check | Command | Catches |
|:------|:--------|:--------|
| ESLint | `bun run lint` (client) | Lint errors, unused vars, React hooks violations |
| TypeScript (client) | `tsc -b --noEmit` | Type errors in frontend |
| TypeScript (server) | `tsc --noEmit` | Type errors in backend |

### On every `git push` (runs in sequence)

| Check | Command | Catches |
|:------|:--------|:--------|
| Unit tests | `npx vitest run` | Component/logic regressions |
| E2E tests | `npx playwright test` | Full user-flow regressions |

If any check fails the commit or push is blocked with a clear error message.

To skip in an emergency (use rarely):
```bash
git commit --no-verify
git push --no-verify
```

### Setup (already done — for new contributors)

```bash
bun install        # installs lefthook
bunx lefthook install  # registers the git hooks
```

---

## Development

### Implementation Progress

| Phase | Description | Status |
|:------|:------------|:-------|
| 1 | Project Setup & Database | 87% |
| 2 | Authentication | Complete |
| 3 | User Management (Admin) | Complete |
| 4 | Ticket CRUD | In Progress (status, category, assignee editing done) |
| 5 | Comments & History | In Progress |
| 6 | Dashboard & My Tickets | Not Started |
| 7 | Polish & Deployment | In Progress |

See [implementation-plan.md](implementation-plan.md) for the detailed task breakdown.

### Coding Guidelines

See [CLAUDE.md](CLAUDE.md) for rules on role constants, schema usage, and other conventions enforced in this codebase.

---

## License

This project is proprietary and for internal use.
