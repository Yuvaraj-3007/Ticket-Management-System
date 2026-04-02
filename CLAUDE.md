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

### What "done" means
A task is only complete when:
1. The plan was presented
2. The code is implemented
3. Playwright tests are written/updated
4. All tests pass (`npx playwright test`)

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
