# Client — React Frontend

React 19 + Vite 8 + TypeScript frontend for the Ticket Management System.

## Stack

| Tool | Purpose |
|:-----|:--------|
| React 19 | UI framework |
| Vite 8 | Dev server and build tool |
| TypeScript 5.9 | Type safety |
| Tailwind CSS 4 | Styling |
| shadcn/ui (Base UI) | Component library |
| React Router DOM 7 | Client-side routing |
| TanStack Query v5 | Server state and caching |
| TanStack Table v8 | Headless table (manualSorting + manualPagination) |
| React Hook Form 7 | Form state management |
| Zod 4 | Schema validation |
| `@tms/core` | Shared schemas and ROLES constants |

## Scripts

```bash
# Development server (port 5173)
bun run dev

# Type check + build
bun run build

# Lint
bun run lint

# Unit tests (run once)
npx vitest run

# Unit tests (watch mode)
npx vitest
```

## Project structure

```
src/
├── components/
│   ├── Navbar.tsx
│   ├── TicketDetail.tsx         # Ticket header, metadata grid, inline editing
│   ├── TicketReplies.tsx        # Reply thread + reply form + AI Polish button (no sender dropdown — senderType derived server-side)
│   ├── EnumSelect.tsx           # Reusable Select for fixed enum options
│   ├── __tests__/
│   │   ├── TicketDetail.test.tsx   # 24 tests
│   │   └── TicketReplies.test.tsx  # 22 tests
│   └── ui/
│       ├── badge.tsx
│       ├── button.tsx
│       ├── card.tsx
│       ├── dialog.tsx
│       ├── input.tsx
│       ├── label.tsx
│       ├── select.tsx
│       ├── skeleton.tsx
│       ├── table.tsx
│       └── textarea.tsx
├── lib/
│   ├── auth-client.ts
│   ├── ticket-badges.ts
│   └── utils.ts
├── pages/
│   ├── __tests__/
│   │   ├── TicketDetail.test.tsx   # 46 tests (TicketDetailPage page tests)
│   │   ├── Tickets.test.tsx        # 24 tests
│   │   └── Users.test.tsx          # 12 tests
│   ├── Dashboard.tsx
│   ├── Login.tsx
│   ├── TicketDetailPage.tsx     # Layout shell: Navbar + TicketDetail + TicketReplies
│   ├── Tickets.tsx
│   └── Users.tsx
├── App.tsx
├── main.tsx
└── setupTests.ts
```

## Environment variables

| Variable | Default | Description |
|:---------|:--------|:------------|
| `VITE_API_URL` | `""` | API base URL (empty = same origin via Vite proxy) |
| `VITE_PROXY_TARGET` | `http://localhost:4000` | Backend URL for Vite dev proxy |

## Routing

| Path | Component | Guard |
|:-----|:----------|:------|
| `/login` | `Login` | GuestRoute (redirects to `/` if authenticated) |
| `/` | `Dashboard` | ProtectedRoute (redirects to `/login` if not authenticated) |
| `/users` | `Users` | AdminRoute (redirects to `/` if not admin) |
| `/tickets` | `Tickets` | ProtectedRoute |
| `/tickets/:id` | `TicketDetailPage` | ProtectedRoute |
