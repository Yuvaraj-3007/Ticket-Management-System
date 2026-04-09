# Customer Portal — Specification

## Overview
A public-facing customer portal that allows clients to submit support tickets, track their status, view conversations, and rate resolved issues. Each client company gets a unique URL slug derived from their HRMS customer name (e.g. `/portal/techvision-solutions`). The portal integrates seamlessly with the existing Right Tracker internal system.

---

## URLs

| URL | Access | Description |
|---|---|---|
| `/portal/:slug` | Public | Ticket submission form for that client |
| `/portal/:slug/login` | Public (guest only) | Customer login page |
| `/portal/forgot-password` | Public | Request password reset email |
| `/portal/reset-password` | Public | Set new password via reset link |
| `/portal/dashboard` | Customer auth | Overview stats (open/closed counts) |
| `/portal/tickets` | Customer auth | Customer's ticket list |
| `/portal/tickets/:id` | Customer auth | Ticket detail + comments + rating |
| `/portal/404` | Public | Unknown slug redirect target |

---

## Customer (End User) Features

### 1. Ticket Submission Form (Public — no login required)
- **URL:** `/portal/:slug` (e.g. `/portal/techvision-solutions`)
- Unknown slugs redirect to `/portal/404`
- Fields:
  - **Name** (text, required)
  - **Email** (email, required)
  - **Project** (dropdown, required) — lists active projects for this client from HRMS
  - **Subject** (text, required)
  - **Body** (textarea, required)
  - **Attachments** (images only — JPEG/PNG/GIF/WEBP, max **1 MB** per file, max **5 files**)
  - **CAPTCHA** (server-signed challenge code — custom implementation, not reCAPTCHA)
- On submit: creates ticket in Right Tracker with status `UN_ASSIGNED`, sends confirmation email to customer
- Customer receives email with ticket ID and a link to track status

### 2. Customer Login / Signup
- **Login URL:** `/portal/:slug/login`
- Email + password (Better Auth)
- First-time customers: register with name + email + password on the same page
- Forgot password → `/portal/forgot-password` → email link → `/portal/reset-password`
- After login: redirected to `/portal/tickets`

### 3. Dashboard (Customer)
- **URL:** `/portal/dashboard`
- Summary stats: total tickets, open tickets, closed tickets

### 4. Ticket List
- **URL:** `/portal/tickets`
- Shows only tickets belonging to the logged-in customer (matched by `hrmsClientId`)
- Columns: Ticket ID, Subject, Status, Priority, Created, Last Updated
- Filters: Status dropdown, From–To date range, search
- Views: List view / Grid view (cards grouped by status)
- Sorting: Latest first (default), Oldest first
- Paginated (10 per page)

### 5. Ticket Detail
- **URL:** `/portal/tickets/:id`
- Shows: Ticket ID, subject, project, status, priority, category, timestamps
- Full conversation thread (customer + agent messages)
  - Sorted: Latest on top (default), toggle to Oldest on top
  - Each message: sender name, timestamp, content, attachments
- Add comment form: body text + image upload (same limits as submit form)
- Status badge (colour-coded)

### 6. Rating (Closed Tickets Only)
- Shown on ticket detail when `status = CLOSED`
- 1–5 star rating
- Optional text feedback
- Can only rate once; shows existing rating if already rated
- Rating visible to agents in Right Tracker internal view

---

## Ticket Status System

| Status | Display Label | Badge Colour |
|---|---|---|
| `UN_ASSIGNED` | Un-Assigned | Grey |
| `OPEN_NOT_STARTED` | Not Started | Amber |
| `OPEN_IN_PROGRESS` | In Progress | Blue |
| `OPEN_QA` | QA | Purple |
| `OPEN_DONE` | Done | Teal |
| `CLOSED` | Closed | Green |

---

## Internal (Right Tracker) Changes

### Ticket Statuses (Implemented)
```
UN_ASSIGNED      → ticket created, no agent yet
OPEN_NOT_STARTED → agent picked up, hasn't started
OPEN_IN_PROGRESS → actively being worked
OPEN_QA          → in quality assurance
OPEN_DONE        → work done, pending formal close
CLOSED           → resolved and closed
```

### Client Management
- No local `Client` table — all client data fetched from HRMS at runtime
- Each portal customer session is bound to an `hrmsClientId` (stored on the `User` model as `portalClientId`)
- Customers can only see tickets belonging to their own HRMS client

### Analytics (Implemented)
- Ticket volume, open/closed ratio, AI-resolved rate
- Average resolution time, daily chart (30 days)
- Agent workload (open + closed today per agent)
- Average customer rating

---

## Email Integration
- Customer submits via portal form → confirmation email sent from `wisright.support@gmail.com`
- Agent replies in Right Tracker → email sent to customer
- Customer replies to email → threaded back into ticket via Gmail Pub/Sub
- Ticket reference footer (`Ticket: TKT-XXXX`) enables reply threading

---

## Feature Status

| Feature | Status |
|---|---|
| Public ticket submission form | ✅ Done |
| Unknown slug → 404 | ✅ Done |
| Customer login + signup | ✅ Done |
| Forgot password / Reset password | ✅ Done |
| Customer dashboard (stats) | ✅ Done |
| Customer ticket list | ✅ Done |
| Status + date range + search filter | ✅ Done |
| List view + Grid view | ✅ Done |
| Ticket detail + comment thread | ✅ Done |
| Add comment from portal (with image upload) | ✅ Done |
| Rating for closed tickets | ✅ Done |
| Image/file attachment (submit + comments) | ✅ Done |
| Server-side CAPTCHA | ✅ Done |
| New OPEN sub-statuses (6-value system) | ✅ Done |
| HRMS project dropdown on submit form | ✅ Done |
| Per-client ticket isolation (portalClientId) | ✅ Done |
| Analytics page (overview + agent workload) | ✅ Done |
| Client branding (logo, colour) | ❌ Not planned |
| Client management in admin panel | ❌ Not planned |

---

## HRMS Integration

### API Base
- **Base URL:** `https://wisework-api.wisright.com/api/v1`
- **Auth:** JWT Bearer token, cached 24 h (service account login)

### Endpoints Used

| Endpoint | Purpose |
|---|---|
| `POST /auth/login` | Obtain JWT token |
| `GET /customers/list` | All active clients (slug validation, client dropdown) |
| `GET /projects/by-customer/:clientId` | Projects for a specific client (portal form dropdown) |
| `GET /projects/:projectId/employees` | Employees on a project (assignee dropdown filtered) |
| `GET /employees/directory` | All active employees (unfiltered assignee fallback) |

### Slug Resolution
Portal slug is the **slugified customer name** (lowercase, spaces/special chars → `-`).
The customer **code** (e.g. `C1332`) also resolves as a slug — the frontend auto-redirects to the name-based slug.

---

## Data Model (Relevant Fields)

### `Ticket`
```
hrmsClientId    String?   -- HRMS customer UUID
hrmsClientName  String?   -- Denormalized client name
hrmsProjectId   String?   -- HRMS project UUID
hrmsProjectName String?   -- Denormalized project name
senderName      String?   -- Portal submitter name
senderEmail     String?   -- Portal submitter email
rating          Int?      -- 1–5, set by customer on CLOSED tickets
ratingText      String?   -- Optional feedback text
```

### `User` (additional field for portal customers)
```
portalClientId  String?   -- HRMS client UUID bound at login (CUSTOMER role only)
```

### `Attachment` (comment attachments)
```
commentId       String?   -- FK to Comment (nullable — ticket-level attachments have no commentId)
```

---

## Environment Variables (server/.env)

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
CAPTCHA_SECRET=<secret>          # optional — falls back to BETTER_AUTH_SECRET
BETTER_AUTH_URL=http://localhost:4000
CLIENT_URL=http://localhost:5173
PORT=4000
```
