# :ticket: Ticket Management System

A centralized ticket management system for tracking support requests, bugs, and tasks across teams.

![React](https://img.shields.io/badge/React-19-blue?logo=react)
![Express.js](https://img.shields.io/badge/Express.js-5-black?logo=express)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue?logo=typescript)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-blue?logo=postgresql)
![Prisma](https://img.shields.io/badge/Prisma-7-2D3748?logo=prisma)
![Playwright](https://img.shields.io/badge/Playwright-46_tests-green?logo=playwright)
![License](https://img.shields.io/badge/License-Proprietary-red)

---

## :clipboard: Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Quick Start](#quick-start)
- [Demo Credentials](#demo-credentials)
- [API Endpoints](#api-endpoints)
- [Database Schema](#database-schema)
- [Testing](#testing)
- [Development](#development)
- [License](#license)

---

## :mag: Overview

Ticket Management System is a full-stack application designed to replace fragmented ticket intake (email, chat, spreadsheets) with a single, centralized platform. Built with a React frontend and Express.js backend, it provides role-based access control, real-time dashboard metrics, and a complete audit trail for every ticket change.

---

## :star2: Key Features

- **Authentication** -- Email/password login with database-backed sessions (sign-up disabled, admin creates users)
- **Role-Based Access Control** -- Admin and Agent roles with route-level protection
- **User Management** -- Admin can create, edit, and deactivate team members
- **Ticket CRUD** -- Create, view, filter, and update tickets with auto-generated IDs (TKT-0001 format)
- **Comments & History** -- Threaded comments on tickets with full change audit trail
- **Dashboard** -- Real-time overview with status counts and recent activity
- **Security** -- Helmet headers, CORS restrictions, rate limiting, Zod input validation

---

## :wrench: Tech Stack

| Layer | Technology |
|:------|:-----------|
| **Runtime** | Bun |
| **Frontend** | React 19, TypeScript, Vite 8, Tailwind CSS 4, shadcn/ui |
| **Routing** | React Router DOM 7 |
| **Forms** | React Hook Form + Zod validation |
| **Backend** | Express.js 5, TypeScript |
| **Database** | PostgreSQL 17 |
| **ORM** | Prisma 7 |
| **Auth** | Better Auth 1.5 (email/password, database sessions) |
| **Security** | Helmet, express-rate-limit, CORS |
| **Testing** | Playwright (end-to-end) |

---

## :building_construction: Architecture

```
Browser (React SPA)
    |
    |-- Vite Dev Server (port 5173)
    |       |
    |       |-- /api/* proxy -->  Express.js (port 5000)
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
```

---

## :file_folder: Project Structure

```
Ticket-Management-System/
├── client/                     # React frontend
│   ├── src/
│   │   ├── components/         # Navbar, shadcn/ui components
│   │   ├── pages/              # Login, Dashboard, Users
│   │   └── lib/                # Auth client, utilities
│   ├── vite.config.ts
│   └── package.json
├── server/                     # Express.js backend
│   ├── src/
│   │   ├── lib/                # Auth config, Prisma client
│   │   └── middleware/         # Auth & admin middleware
│   ├── prisma/
│   │   ├── schema.prisma       # Database schema
│   │   ├── migrations/         # SQL migrations
│   │   └── seed.ts             # Default admin seed
│   ├── .env.example
│   └── package.json
├── tests/                      # Playwright e2e tests
│   ├── auth.spec.ts            # Authentication tests (46 tests)
│   ├── example.spec.ts         # Smoke test
│   ├── global-setup.ts         # Test DB migration & seed
│   └── global-teardown.ts      # Test DB cleanup
├── playwright.config.ts
├── implementation-plan.md
├── tech-stack.md
└── package.json
```

---

## :rocket: Quick Start

### Prerequisites

- [Bun](https://bun.sh/) -- runtime and package manager
- [PostgreSQL 17](https://www.postgresql.org/) -- running on port 5433
- [Node.js](https://nodejs.org/) -- required for Playwright

### 1. Clone the repository

```bash
git clone https://github.com/Yuvaraj-3007/Ticket-Management-System.git
cd Ticket-Management-System
```

### 2. Install dependencies

```bash
# Root (Playwright)
bun install

# Server
cd server && bun install

# Client
cd ../client && bun install
```

### 3. Configure environment

```bash
cp server/.env.example server/.env
```

Edit `server/.env`:

```env
PORT=5000
DATABASE_URL=postgresql://postgres:your_password@localhost:5433/ticket_management
BETTER_AUTH_SECRET=your-secret-key-min-32-chars
BETTER_AUTH_URL=http://localhost:5000
CLIENT_URL=http://localhost:5173
NODE_ENV=development
```

### 4. Set up the database

```bash
cd server
bunx prisma migrate deploy
bun run prisma/seed.ts
```

### 5. Start development servers

```bash
# Terminal 1 -- Backend (port 5000)
cd server && bun run src/index.ts

# Terminal 2 -- Frontend (port 5173)
cd client && bun run dev
```

Open [http://localhost:5173](http://localhost:5173) to access the application.

---

## :key: Demo Credentials

| Role | Email | Password |
|:-----|:------|:---------|
| **Admin** | `admin@wisright.com` | `Test@123` |

> Sign-up is disabled. Only admins can create new users.

---

## :globe_with_meridians: API Endpoints

### Authentication

| Method | Endpoint | Description |
|:-------|:---------|:------------|
| `POST` | `/api/auth/sign-in/email` | Login with email/password |
| `POST` | `/api/auth/sign-out` | Logout and destroy session |
| `GET` | `/api/auth/get-session` | Get current session info |

### System

| Method | Endpoint | Description |
|:-------|:---------|:------------|
| `GET` | `/api/health` | Health check |

> More endpoints (users, tickets, comments, dashboard) are being added as part of the implementation plan.

---

## :floppy_disk: Database Schema

### Models

| Model | Description |
|:------|:------------|
| **User** | Email, name, role (ADMIN/AGENT), active status |
| **Session** | Database-backed auth sessions (7-day expiry, daily refresh) |
| **Ticket** | Title, description, type, priority, status, assignee, project |
| **Comment** | Threaded comments on tickets with author |
| **Attachment** | File attachments linked to tickets |
| **TicketHistory** | Audit trail logging every ticket change |

### Enums

| Enum | Values |
|:-----|:-------|
| **TicketType** | `BUG` `REQUIREMENT` `TASK` `SUPPORT` |
| **Priority** | `LOW` `MEDIUM` `HIGH` `CRITICAL` |
| **Status** | `OPEN` `IN_PROGRESS` `RESOLVED` `CLOSED` |

---

## :test_tube: Testing

The project uses **Playwright** for end-to-end testing with a separate test database.

```bash
# Run all tests (headless)
bunx playwright test

# Run with interactive UI
bunx playwright test --ui

# Run a specific test file
bunx playwright test tests/auth.spec.ts

# View HTML test report
bunx playwright show-report tests/playwright-report
```

### Test Infrastructure

- **Test database:** `ticket_management_test` (auto-created, isolated from dev)
- **Test servers:** Backend on port 5001, Frontend on port 5174
- **Setup:** Migrations + admin user seed before each run
- **Teardown:** All tables truncated after tests complete

### Test Coverage

| Suite | Tests | Coverage |
|:------|:------|:---------|
| Login page rendering | 4 | Form elements, field types, initial state |
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
| **Total** | **46** | |

---

## :hammer_and_wrench: Development

### Implementation Progress

| Phase | Description | Status |
|:------|:------------|:-------|
| 1 | Project Setup & Database | 87% |
| 2 | Authentication | Complete |
| 3 | User Management (Admin) | In Progress |
| 4 | Ticket CRUD | Not Started |
| 5 | Comments & History | Not Started |
| 6 | Dashboard & My Tickets | Not Started |
| 7 | Polish & Deployment | In Progress |

See [implementation-plan.md](implementation-plan.md) for the detailed task breakdown.

---

## :page_facing_up: License

This project is proprietary and for internal use.
