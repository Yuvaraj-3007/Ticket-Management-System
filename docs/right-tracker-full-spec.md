# Right Tracker — Full Product Specification

**Version:** 2.1  
**Last Updated:** 2026-04-09  
**Status:** POC Complete — Production Hardening

---

## 1. Product Overview

Right Tracker is a full-stack technical support ticket management system for **WisRight**. It has two sides:

| Side | Users | Purpose |
|---|---|---|
| **Customer Portal** | Client company employees | Submit tickets, track status, view conversations, rate resolutions |
| **Internal (TSA) System** | WisRight support agents, TSA admins | Receive tickets, assign, work, close, reply |

Client and employee data is sourced from **WiseWork HRMS** (external system, base URL: `https://wisework-api.wisright.com/api/v1`). No local Client or Employee table is maintained — all lookups are done via HRMS API at runtime.

---

## 2. Use Case — Complete Requirements

### 2.1 Customer Portal

#### Portal URL Structure
- Each client gets their own portal URL: `https://support.wisright.com/<customer-code>`
  - Example: `https://support.wisright.com/drive-ev`
- The `<customer-code>` maps to the `customerCode` field in HRMS (case-insensitive)
- Any unknown/invalid slug → redirect to **404 page**

#### Ticket Submission Form (Public — No Login Required)
Fields:
- **Name** (text, required)
- **Email** (email, required)
- **Project** (dropdown, required) — lists projects belonging to that client from HRMS
- **Subject** (text, required)
- **Body** (textarea, required)
- **Attachments** (images only — JPEG/PNG/GIF/WEBP, max **1 MB** per file, max **5 files**)
- **CAPTCHA** (server-signed custom challenge — not reCAPTCHA)

On submit:
- Ticket created in Right Tracker DB
- Status set to `UN_ASSIGNED`
- Customer assigned as `senderName` + `senderEmail`
- HRMS client info stored (`hrmsClientId`, `hrmsClientName`, `hrmsProjectId`, `hrmsProjectName`)
- Confirmation email sent to customer with Ticket ID + portal link

#### Customer Login
- URL: `/portal/<slug>/login`
- Sign in with email + password (Better Auth)
- Sign up (first-time customers)
- After login → redirected to `/portal/tickets`

#### Customer Ticket List (Authenticated)
- Shows only that customer's tickets (matched by email)
- Filters:
  - **Status** dropdown (Un-Assigned, Not Started, In Progress, QA, Done, Closed)
  - **From Date** — **To Date** (date range picker)
- Views:
  - **List View** (table with ID, Subject, Project, Status, Priority, Date)
  - **Grid View** (cards grouped by status)
- Sort: Latest first (default) / Oldest first
- Pagination: 10 per page

#### Ticket Detail (Authenticated)
- Shows: Ticket ID, Subject, Project, Status, Priority, Category, Created timestamp
- Full **conversation thread** (chain of events):
  - Customer messages + Agent replies in one unified thread
  - Sort toggle: **Latest on top** (default) / **Oldest on top**
  - Each message: sender name, timestamp, content, attachments
- Add comment form: body text + image upload
- Status badge (color-coded)

#### Rating (Closed Tickets Only)
- Shown when `status = CLOSED`
- 1–5 star rating + optional text feedback
- Can rate only once; shows existing rating if already rated
- Rating visible to agents in the internal system

---

### 2.2 Internal System — TSA (Tech Support Admin)

#### TSA Ticket View
- Default filter: **Un-Assigned status** tickets
- Separate quick-filter: "Unassigned Customer" (tickets where no customer is linked)
- List columns: ID, Subject, Client, Project, Sender, Status, Priority, Category, Assigned To, Date

#### Opening a Ticket
When an agent opens a ticket, they can set:
- **Status:** Un-Assigned → Open (Not Started / In Progress / QA / Done) → Closed
- **Priority:** Low / Medium / High / Critical
- **Category:** Bug / New Requirement / Advisory Support / Task
- **Assign to Customer:** link to the HRMS client account
- **Assign to Developer:** select from HRMS project members (filtered by the ticket's project)
- **Assign to Support Employee:** select from HRMS project members or all employees

#### Conversation Thread (Chain of Events)
- Unified view: customer messages + agent replies + system events (status changes, assignments)
- Sort: Latest on top (default), toggle to Oldest on top
- Option to add comment: Subject (optional), Body text, Image upload
- Agent reply → triggers outbound email to customer

#### Ticket Filters
- Status dropdown (all 6 values)
- From–To date range filter
- Client filter (HRMS customer)
- Project filter
- Assigned to filter

#### Views
- **List View** (default): sortable table
- **Grid View**: cards grouped by ticket status columns

#### Analytics
- **Ticket Stats:** total, open, closed, AI-resolved, avg resolution time, daily chart
- **Support Executive Performance:** tickets handled, avg response time, resolution rate, rating score per agent
- **Developer Stats:** tickets assigned per developer, resolution time, open vs closed
- **Client-level stats:** tickets per client, project breakdown

---

## 3. Ticket Status System

```
UN_ASSIGNED        →  Ticket submitted (portal/email), no agent yet
OPEN_NOT_STARTED   →  Agent picked up, hasn't started
OPEN_IN_PROGRESS   →  Actively being worked
OPEN_QA            →  In quality assurance
OPEN_DONE          →  Work done, pending formal close
CLOSED             →  Fully resolved and closed
```

| Status | Display Label | Badge Color |
|---|---|---|
| UN_ASSIGNED | Un-Assigned | Grey |
| OPEN_NOT_STARTED | Not Started | Amber |
| OPEN_IN_PROGRESS | In Progress | Blue |
| OPEN_QA | QA | Purple |
| OPEN_DONE | Done | Teal |
| CLOSED | Closed | Green |

---

## 4. HRMS Integration

### 4.1 HRMS Base

| Property | Value |
|---|---|
| Base URL | `https://wisework-api.wisright.com/api/v1` |
| Auth | JWT Bearer token (24h expiry) |
| Login endpoint | `POST /api/v1/auth/login` |
| Service account | HRMS admin credentials stored in server `.env` |

### 4.2 Confirmed HRMS Endpoints

#### Customers (Clients)
```
GET /api/v1/customers?page=1&limit=10&isActive=true&sortBy=customerName&sortOrder=ASC
```
Returns paginated list of active clients.

Response fields used:
- `id` — HRMS customer UUID
- `customerCode` — maps to portal slug (e.g. `CL1COG` → slug `drive-ev`)
- `customerName` — display name (e.g. "DriveEV")
- `isActive` — filter active only

#### Employees
```
GET /api/v1/employees/statuses
```
Returns individual project team members with their employment status.

Response fields used:
- `id` — HRMS employee UUID
- `firstName`, `lastName` — display name in assignee dropdown
- `email` — for matching
- `designation` / `department` — optional display info

### 4.3 Confirmed HRMS Endpoints (All Working)

#### Projects by Client ✅
```
GET /projects/by-customer/:hrmsClientId
```
Returns active projects for a client. Fields used: `id`, `projectCode`, `projectName`, `status`, `isActive`.

#### Project Members ✅
```
GET /projects/:hrmsProjectId/employees
```
Returns employees assigned to a project. Fields used: `id`, `user.firstName`, `user.lastName`, `user.email`.

---

## 5. Data Flow

### Portal Ticket Submission
```
Customer opens /portal/drive-ev
  → Backend: GET HRMS /customers?code=drive-ev → validate slug, get clientId
  → Frontend: fetch projects for this client → show Project dropdown
  → Customer fills form + selects project + submits
  → Backend: POST /api/portal/drive-ev/tickets
      → creates Ticket { status: UN_ASSIGNED, hrmsClientId, hrmsClientName, hrmsProjectId, hrmsProjectName, senderName, senderEmail }
      → sends confirmation email to customer
```

### Agent Assigns Developer
```
Agent opens ticket in Right Tracker
  → Assignee dropdown calls: GET /api/tickets/assignable-users?projectId=<hrmsProjectId>
  → Backend: GET HRMS /projects/<id>/members → return filtered employee list
  → Agent selects developer → PATCH /api/tickets/:id/assignee { assignedToId }
```

### Email Flow
```
Customer email → wisright.support@gmail.com
  → Gmail Pub/Sub → POST /api/webhooks/gmail
  → If "Ticket: TKT-XXXX" in body → add CUSTOMER comment to existing ticket
  → Otherwise → create new ticket (status: UN_ASSIGNED)

Agent replies in Right Tracker
  → POST /api/tickets/:id/comments
  → Triggers sendReplyEmail() → email sent to customer's senderEmail
  → Customer sees reply, can reply back via email (threads back in)
```

---

## 6. Server-Side Architecture

### New/Updated Files

| File | Change | Purpose |
|---|---|---|
| `server/src/lib/hrms.ts` | Update | Add `getClientProjects()`, `getProjectMembers()`, cache JWT |
| `server/src/routes/portal.ts` | Update | Add project dropdown endpoint, store hrmsProjectId on submit |
| `server/src/routes/tickets.ts` | Update | Filter assignable-users by projectId (optional param) |
| `server/prisma/schema.prisma` | Update | Add `hrmsProjectId`, `hrmsProjectName` to Ticket model |
| `server/src/middleware/customerAuth.ts` | Exists | Auth for portal-authenticated routes |

### New HRMS lib functions needed
```typescript
// Get JWT token (cached 24h)
getHrmsToken(): Promise<string>

// Validate portal slug → return client info
getClientBySlug(slug: string): Promise<{ id, customerCode, customerName } | null>

// Get projects for a client (for portal form dropdown)
getClientProjects(hrmsClientId: string): Promise<{ id, projectCode, projectName }[]>

// Get members of a project (for assignee dropdown)
getProjectMembers(hrmsProjectId: string): Promise<{ id, name, email, role }[]>

// Get all employees (fallback when no project context)
getAllEmployees(): Promise<{ id, name, email }[]>
```

### Updated API Endpoints

| Method | Path | Change |
|---|---|---|
| `GET` | `/api/portal/:slug/projects` | **NEW** — returns HRMS project list for that client |
| `GET` | `/api/tickets/assignable-users?projectId=X` | **UPDATE** — add optional `projectId` filter |
| `POST` | `/api/portal/:slug/tickets` | **UPDATE** — accept + store `hrmsProjectId`, `hrmsProjectName` |

---

## 7. Frontend Changes

### Portal Ticket Submit Form
- Add `Project` dropdown after email field
- On slug load → `GET /api/portal/:slug/projects` → populate dropdown
- Store selected `hrmsProjectId` + `hrmsProjectName` in form state
- Submit includes `projectId` + `projectName` in request body

### Internal Ticket Detail — Assignee Dropdown
- When ticket has `hrmsProjectId`: call `GET /api/tickets/assignable-users?projectId=<hrmsProjectId>`
- When no project: call `GET /api/tickets/assignable-users` (all employees, current behavior)
- Assignee list shows name + role/designation from HRMS

---

## 8. Implementation Status

### Done ✅
- Portal URL routing (`/portal/:slug`)
- 404 for unknown slugs
- Public ticket submit form (name, email, project, subject, body)
- Project dropdown on submit form (HRMS `getClientProjects`)
- Image/file attachment on submit form + comments (1 MB, 5 files max)
- Server-side CAPTCHA on portal submission
- Customer login + signup
- Forgot password + reset password flow
- Customer dashboard (stats overview)
- Customer ticket list (status/date/search filter, list/grid view, pagination)
- Customer ticket detail + comment thread + sort toggle
- Add comment from portal (with image upload)
- Rating for closed tickets (1–5 stars + text)
- Ticket status system (6 values: UN_ASSIGNED → OPEN_* → CLOSED)
- Per-client ticket isolation (`User.portalClientId` → `hrmsClientId` filter)
- Email inbound (Gmail Pub/Sub → ticket creation / reply threading)
- Email outbound (agent reply → email to customer)
- HRMS slug validation (slugified customer name, code fallback)
- HRMS project list endpoint confirmed and wired
- HRMS assignee dropdown (all employees + filtered by project)
- AI auto-classify (type + priority via Kimi)
- AI auto-resolve (KB check → OPEN_DONE or OPEN_NOT_STARTED)
- Analytics page (overview stats, agent workload, daily chart, avg rating)
- Internal ticket list (sort, filter, paginate)
- Internal ticket detail (status/type/priority/assignee edit)
- Role-based access control (ADMIN/AGENT for internal, CUSTOMER for portal)
- Rate limiting on all public endpoints
- Security headers (Helmet + CSP)

### In Progress / Partial ⚠️
- From/To date filter: backend supports it, frontend date picker UI not yet added
- Grid view: exists but cards not grouped by status columns

### Not Started ❌
- Analytics: per-exec + per-developer performance breakdown
- Client branding (logo, colour per portal)
- Client management in admin panel
- Email admin config UI

---

## 9. Environment Variables (server/.env)

```env
# HRMS Integration
HRMS_API_URL=https://wisework-api.wisright.com/api/v1
HRMS_API_EMAIL=admin@wisright.com
HRMS_API_PASSWORD=<hrms_service_account_password>

# Gmail (inbound + outbound)
GMAIL_USER=wisright.support@gmail.com
GMAIL_APP_PASSWORD=<app_password>
GOOGLE_CLIENT_ID=<oauth_client_id>
GOOGLE_CLIENT_SECRET=<oauth_client_secret>
GOOGLE_REFRESH_TOKEN=<refresh_token>
GMAIL_PUBSUB_TOPIC=<gcp_pubsub_topic>
GMAIL_PUBSUB_SECRET=<shared_secret>

# Core
DATABASE_URL=postgresql://...
BETTER_AUTH_SECRET=<secret>
BETTER_AUTH_URL=http://localhost:4000
CLIENT_URL=http://localhost:5173
PORT=4000
```

---

## 10. Resolved Clarifications

| # | Question | Resolution |
|---|---|---|
| 1 | HRMS endpoint for projects by client | `GET /projects/by-customer/:clientId` ✅ |
| 2 | HRMS endpoint for project members | `GET /projects/:projectId/employees` ✅ |
| 3 | CustomerCode vs slug | Slug = slugified `customerName`; code also resolves (auto-redirects) ✅ |
| 4 | File attachment storage | Local disk (`uploads/` directory), served with `Content-Disposition: attachment` ✅ |
| 5 | CAPTCHA approach | Custom server-signed CAPTCHA (HMAC-SHA256) — no reCAPTCHA dependency ✅ |
| 6 | File size limit | 1 MB per file, max 5 files (images only: JPEG/PNG/GIF/WEBP) ✅ |

## 11. Open Items

| # | Item | Owner |
|---|---|---|
| 1 | From/To date picker UI on portal ticket list | Frontend |
| 2 | Grid view grouped by status columns | Frontend |
| 3 | Per-agent + per-developer analytics breakdown | Backend + Frontend |
| 4 | Cloud storage for attachments (S3/GCS) for production | Infrastructure |
