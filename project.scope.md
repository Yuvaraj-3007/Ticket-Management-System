# Project Scope: Ticket Management System

## 1. Background & Problem Statement

We are a **SaaS and product development company**. Currently, all client requirements, bug reports, and task requests are received through **fragmented channels**:

- **Email**
- **WhatsApp**
- **Microsoft Teams**

There is **no centralized ticket management system** in place. This leads to:

- Requirements getting lost or overlooked across channels
- No visibility into ticket status or priority
- No accountability or assignment tracking
- Difficulty measuring team workload and response times
- Duplicate work due to lack of a single source of truth
- No historical record for audits or client reporting

## 2. Project Objective

Build a **centralized Ticket Management System** that captures, tracks, assigns, and resolves all incoming requirements and issues from a single platform — replacing the current scattered email/WhatsApp/Teams workflow.

## 3. Key Features

### 3.1 Ticket Creation & Intake

- Manual ticket creation via web dashboard
- **Email integration** — auto-create tickets from incoming emails
- **WhatsApp integration** — capture messages as tickets (via WhatsApp Business API)
- **Microsoft Teams integration** — create tickets from Teams messages/channels
- Ticket creation via API (for future integrations)

### 3.2 Ticket Properties

- **Ticket ID** — unique, auto-generated (e.g., TKT-0001)
- **Title** — short summary
- **Description** — detailed requirement or issue
- **Source** — Email / WhatsApp / Teams / Manual / API
- **Type** — Requirement / Bug / Task / Enhancement / Support
- **Priority** — Critical / High / Medium / Low
- **Status** — Open / In Progress / On Hold / Resolved / Closed / Reopened
- **Assigned To** — team member or team
- **Reporter / Client** — who raised the ticket
- **Project / Product** — which product or project it belongs to
- **Tags / Labels** — for categorization
- **Attachments** — files, screenshots, documents
- **Due Date** — expected resolution date
- **Created Date / Updated Date** — timestamps

### 3.3 Dashboard & Views

- **Overview dashboard** with ticket counts by status, priority, and assignee
- Kanban board view (drag-and-drop status changes)
- List/table view with sorting, filtering, and search
- My Tickets view (assigned to current user)
- Team-wise ticket view
- Project/product-wise ticket view

### 3.4 Assignment & Workflow

- Assign tickets to individuals or teams
- Reassign and escalate tickets
- Configurable workflow stages per project
- Auto-assignment rules (round-robin, load-based)
- SLA timers — define response and resolution time targets
- SLA breach alerts and escalation

### 3.5 Communication & Collaboration

- Internal comments and notes on tickets (visible to team only)
- Client-facing replies (sent back via the original channel)
- @mention team members
- Activity log / audit trail on each ticket
- File attachments in comments

### 3.6 Notifications & Alerts

- In-app notifications
- Email notifications for ticket updates
- Configurable notification preferences per user
- SLA breach alerts
- Daily/weekly digest reports

### 3.7 Reporting & Analytics

- Tickets created vs resolved over time
- Average resolution time
- SLA compliance rate
- Tickets by source channel (Email / WhatsApp / Teams)
- Tickets by project, team, and assignee
- Overdue ticket reports
- Exportable reports (CSV, PDF)

### 3.8 User & Role Management

- **Roles**: Super Admin, Admin, Manager, Agent, Viewer
- Role-based access control (RBAC)
- Team/department management
- User invitation and onboarding

### 3.9 Client / Customer Management

- Client directory with contact details
- Link tickets to clients
- Client-wise ticket history
- Client portal (optional — let clients view their ticket status)

### 3.10 Project & Product Management

- Create and manage multiple projects/products
- Map tickets to specific projects
- Project-level dashboards and reports

## 4. Integrations

| Integration       | Purpose                                      | Priority |
| ------------------ | -------------------------------------------- | -------- |
| Email (IMAP/SMTP)  | Auto-create tickets from emails, send replies | High     |
| WhatsApp Business  | Capture WhatsApp messages as tickets          | High     |
| Microsoft Teams    | Create tickets from Teams conversations       | High     |
| Slack (future)     | Optional channel integration                  | Low      |
| Calendar           | Due date sync                                 | Medium   |
| File Storage       | Attachment storage (S3 / Azure Blob)          | High     |

## 5. User Roles & Permissions

| Role        | Permissions                                                       |
| ----------- | ----------------------------------------------------------------- |
| Super Admin | Full system access, settings, user management, billing            |
| Admin       | Manage projects, teams, users, workflows                          |
| Manager     | View team tickets, assign, reassign, reports                      |
| Agent       | Create, update, resolve tickets assigned to them                  |
| Viewer      | Read-only access to tickets and dashboards                        |
| Client      | View own tickets, add comments (via client portal, if applicable) |

## 6. Non-Functional Requirements

- **Performance** — Dashboard loads under 2 seconds, search under 1 second
- **Scalability** — Support 500+ concurrent users, 100K+ tickets
- **Security** — HTTPS, encrypted data at rest, role-based access, audit logs
- **Availability** — 99.9% uptime target
- **Data Backup** — Automated daily backups with 30-day retention
- **Mobile Responsive** — Fully usable on mobile browsers
- **Browser Support** — Chrome, Edge, Firefox, Safari (latest 2 versions)

## 7. Out of Scope (Phase 1)

- Native mobile apps (iOS/Android) — planned for Phase 2
- Multi-language / localization support
- Time tracking and billing within tickets
- Public knowledge base
- Chat widget for website
- Third-party marketplace integrations (Jira, Zendesk import)

## 8. Success Criteria

- All incoming requirements are captured in one system (zero lost tickets)
- Average ticket response time reduced by 50%
- Full visibility into ticket status for managers and clients
- SLA tracking and compliance reporting in place
- Team workload is measurable and balanced

## 9. Stakeholders

| Role               | Responsibility                          |
| ------------------ | --------------------------------------- |
| Product Owner      | Define priorities, approve features     |
| Project Manager    | Timeline, milestones, delivery          |
| Development Team   | Build and deploy the system             |
| QA Team            | Testing and quality assurance           |
| Operations / Admin | User management, configuration          |
| End Users (Agents) | Day-to-day ticket handling              |
| Clients            | Raise requirements, track ticket status |

## 9a. Actual Tech Stack (Phase 1 Implementation)

| Layer     | Technology                                                                 |
| --------- | -------------------------------------------------------------------------- |
| Runtime   | Bun                                                                        |
| Frontend  | React 19 + TypeScript + Vite 8 + Tailwind CSS v4 + shadcn/ui (Base UI)    |
| Charts    | Recharts (Dashboard bar chart)                                             |
| Backend   | Express.js 5 + TypeScript                                                  |
| Database  | PostgreSQL 17                                                              |
| ORM       | Prisma 7 with `@prisma/adapter-pg`                                         |
| Auth      | Better Auth 1.5 (email/password, database sessions)                        |
| AI        | Kimi (Moonshot AI) via Vercel AI SDK — polish, summarize, classify, auto-resolve |
| Job Queue | pg-boss v12 — classify-ticket + auto-resolve-ticket workers                |
| Shared    | `@tms/core` workspace package (Zod schemas, ROLES)                         |
| Testing   | Playwright (E2E, 158 tests) + Vitest (unit, 128 tests)                     |
| Hosting   | Docker + Coolify (self-hosted, planned)                                    |

---

## 10. Milestones (High Level)

| Phase   | Scope                                                    |
| ------- | -------------------------------------------------------- |
| Phase 1 | Core ticket CRUD, dashboard, user roles, email intake    |
| Phase 2 | WhatsApp & Teams integration, SLA engine, notifications  |
| Phase 3 | Reporting & analytics, client portal                     |
| Phase 4 | Advanced workflows, auto-assignment, mobile optimization |
