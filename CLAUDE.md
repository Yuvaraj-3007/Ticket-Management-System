# Coding Guidelines

## Mandatory Workflow — Every Prompt

For **every implementation request** (new feature, bug fix, refactor, or any code change), follow this exact sequence — no exceptions:

### Step 1 — Plan first
Before writing any code, enter plan mode and produce a clear plan that covers:
- What files will be created or modified
- What the API / data shape looks like (schemas, routes, props)
- What edge cases or constraints matter
- Any risks or alternatives considered

Do not write a single line of implementation code until the plan is presented and implicitly accepted (i.e. the user proceeds without objecting).

### Step 2 — Implement
Execute the plan. Follow all coding guidelines in this file.

### Step 3 — Tests (mandatory)
After every implementation, write or update Playwright e2e tests in `tests/`.

Rules for tests:
- New API endpoint → add API-level tests (auth, happy path, validation, 404/400 cases)
- New UI page or interaction → add UI-level tests (navigation, rendering, user flows, error states)
- Modified behaviour → update existing tests to match
- Never leave implementation code without test coverage
- Run the tests and confirm they pass before considering the task done
- E2E tests cover only what cannot be unit tested: real API calls, database persistence, browser navigation, multi-step user flows. Do not duplicate in E2E what is already asserted by a unit test.

### What "done" means
A task is only complete when:
1. The plan was presented
2. The code is implemented
3. Playwright tests are written/updated
4. All tests pass (`npx playwright test`)

---

## Parallel agents — use based on requirement level

Whenever a task has independent subtasks, launch multiple agents in parallel using the Agent tool. Match the number of agents to the complexity:

| Situation | Agents to use |
|:----------|:--------------|
| Single file change or simple lookup | No agent — do it directly |
| 2–3 independent files (e.g. updating separate docs) | 2 agents in parallel |
| Large feature with independent concerns (e.g. backend + frontend + tests) | 3+ agents in parallel |
| Research across multiple parts of the codebase | Explore agent |

**Rules:**
- Never spawn an agent for work you can do in one tool call
- Never make agents depend on each other unnecessarily — split work so each agent is fully independent
- Always use a single message with multiple Agent tool calls to run them truly in parallel
- If one agent's output is needed as input for another, run them sequentially instead

---

## Git — Never commit or push without explicit approval

> Pre-commit and pre-push hooks (Lefthook) run automatically on every commit and push. Do not use `--no-verify` unless the user explicitly asks.

**Never run `git commit` or `git push` (or any variant) unless the user explicitly says to.**

Examples of explicit approval:
- "commit and push it"
- "go ahead and commit"
- "push it"

If you finish implementing a feature or fix, stop after the tests pass. Do not commit, do not push, do not suggest doing so. Wait for the user to give the instruction.

This rule has no exceptions — not even for "minor" changes like docs or config files.

---


## Reusable UI components

### `EnumSelect` — `client/src/components/EnumSelect.tsx`

Use this whenever you need a Select dropdown over a fixed set of string values (enums, const arrays).
It handles the trigger label, item list, disabled state, and inline error message in one place.

```tsx
import { EnumSelect } from "@/components/EnumSelect";

<EnumSelect
  value={ticket.status}
  options={STATUSES}           // readonly string tuple
  labels={STATUS_LABELS}       // Record<value, display string>
  onValueChange={(val) => statusMutation.mutate(val)}
  disabled={statusMutation.isPending}
  isError={statusMutation.isError}
  errorMessage="Failed to update status"
  width="w-[150px]"            // optional, defaults to w-[150px]
/>
```

Do **not** inline a raw `<Select>` + items loop for enum fields — use `EnumSelect` instead.
The Assignee select is exempt because it has a nullable "Unassigned" option with custom rendering.

---

### `TicketReplies` — `client/src/components/TicketReplies.tsx`

Self-contained reply thread + reply form for a ticket detail page.
Owns the comments query, reply mutation, textarea state, and senderType selection.

```tsx
import { TicketReplies } from "@/components/TicketReplies";

<TicketReplies ticketId={ticket.ticketId} />
```

Pass the human-readable `ticketId` (e.g. `"TKT-0001"`), not the DB `id`.

---

## Role strings

Never use `"ADMIN"` or `"AGENT"` as string literals anywhere in the client or server code.

Always import and use the shared constants from `@tms/core`:

```ts
import { ROLES } from "@tms/core";

// ✅ correct
if (user.role === ROLES.ADMIN) { ... }
defaultValues: { role: ROLES.AGENT }

// ❌ wrong
if (user.role === "ADMIN") { ... }
defaultValues: { role: "AGENT" }
```

Use `UserRole` as the TypeScript type for any role value:

```ts
import { type UserRole } from "@tms/core";

function doSomething(role: UserRole) { ... }
```

Use `USER_ROLES` (the tuple `["ADMIN", "AGENT"]`) only when you need to enumerate all roles, e.g. for a `z.enum(USER_ROLES)` schema or a `.includes()` check.

This rule applies to:
- React components (`App.tsx`, `Navbar.tsx`, `Users.tsx`, etc.)
- Tests (fixture objects inside test bodies — `vi.mock` factory strings are exempt since they are hoisted before imports)
- Any future server route or middleware that references role values
