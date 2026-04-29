import { test, expect, type Page, type APIRequestContext } from "@playwright/test";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ADMIN_EMAIL    = "admin@wisright.com";
const ADMIN_PASSWORD = "Test@123";
const BASE           = (process.env.TEST_BACKEND_URL ?? "http://localhost:5001").replace("localhost", "127.0.0.1");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function loginAsAdmin(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(ADMIN_EMAIL);
  await page.getByLabel("Password").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page).toHaveURL("/");
}

/** Navigate to the ticket detail page and wait for the API response. */
async function gotoDetail(page: Page, id: string) {
  await Promise.all([
    page.waitForResponse((r) => r.url().includes(`/api/tickets/${id}`) && !r.url().includes("?")),
    page.goto(`/tickets/${id}`),
  ]);
}

async function apiSignIn(request: APIRequestContext): Promise<string> {
  const res = await request.post(`${BASE}/api/auth/sign-in/email`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    headers: { "Content-Type": "application/json" },
  });
  expect(res.status()).toBe(200);
  const setCookie = res.headers()["set-cookie"] ?? "";
  return setCookie.split(";")[0];
}

/** Create a ticket via webhook and return its ticketId (e.g. "TKT-0001"). */
async function seedTicket(
  request: APIRequestContext,
  overrides: { subject?: string; body?: string; from?: string } = {}
): Promise<string> {
  const res = await request.post(`${BASE}/api/webhooks/email`, {
    data: {
      from:    overrides.from    ?? "detail-test@example.com",
      subject: overrides.subject ?? "Detail page test ticket",
      body:    overrides.body    ?? "This ticket was created to test the detail page.",
    },
    headers: { "Content-Type": "application/json" },
  });
  expect(res.status()).toBe(201);
  const { ticketId } = await res.json();
  return ticketId as string;
}

// ---------------------------------------------------------------------------
// Suite 1 — GET /api/tickets/:id  (direct API)
// ---------------------------------------------------------------------------

test.describe.configure({ mode: "serial" });

test.describe("GET /api/tickets/:id — API", () => {
  let ticketId: string;

  test.beforeAll(async ({ request }) => {
    ticketId = await seedTicket(request, { subject: "API detail test" });
  });

  test("returns 401 when not authenticated", async ({ request }) => {
    const res = await request.get(`${BASE}/api/tickets/${ticketId}`);
    expect(res.status()).toBe(401);
  });

  test("returns 200 with the ticket when authenticated", async ({ request }) => {
    await apiSignIn(request);
    const res = await request.get(`${BASE}/api/tickets/${ticketId}`);
    expect(res.status()).toBe(200);
  });

  test("response contains all required fields", async ({ request }) => {
    await apiSignIn(request);
    const ticket = await (await request.get(`${BASE}/api/tickets/${ticketId}`)).json();

    for (const field of ["id", "ticketId", "title", "description", "type", "priority", "status", "project", "createdAt", "updatedAt", "createdBy"]) {
      expect(ticket).toHaveProperty(field);
    }
  });

  test("returned ticketId matches the requested one", async ({ request }) => {
    await apiSignIn(request);
    const ticket = await (await request.get(`${BASE}/api/tickets/${ticketId}`)).json();
    expect(ticket.ticketId).toBe(ticketId);
  });

  test("title matches the webhook subject", async ({ request }) => {
    await apiSignIn(request);
    const ticket = await (await request.get(`${BASE}/api/tickets/${ticketId}`)).json();
    expect(ticket.title).toBe("API detail test");
  });

  test("returns 404 for a non-existent ticketId", async ({ request }) => {
    await apiSignIn(request);
    const res = await request.get(`${BASE}/api/tickets/TKT-9999`);
    expect(res.status()).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Suite 2 — Ticket detail page  (e2e UI)
// ---------------------------------------------------------------------------

test.describe("Ticket detail page — UI", () => {
  let ticketId: string;

  test.beforeAll(async ({ request }) => {
    ticketId = await seedTicket(request, {
      subject: "Network Issue Troubleshooting",
      body:    "Users on floor 3 cannot reach the internal wiki.\nRestarting the switch did not help.",
    });
  });

  test("unauthenticated user navigating to detail page is redirected to /login", async ({ page }) => {
    await page.goto(`/tickets/${ticketId}`);
    await expect(page).toHaveURL("/login");
  });

  test("direct URL navigation renders the detail page", async ({ page }) => {
    await loginAsAdmin(page);
    await gotoDetail(page, ticketId);
    await expect(page.getByText(ticketId)).toBeVisible();
  });

  test("Back to Tickets button navigates to /tickets", async ({ page }) => {
    await loginAsAdmin(page);
    await gotoDetail(page, ticketId);
    await page.getByRole("link", { name: /Back to Tickets/i }).click();
    await expect(page).toHaveURL("/tickets");
    await expect(page.getByRole("heading", { name: "Tickets" })).toBeVisible();
  });

  test("clicking a ticket title in the list navigates to its detail page", async ({ page }) => {
    await loginAsAdmin(page);
    await Promise.all([
      page.waitForResponse((resp) => resp.url().includes("/api/tickets?") && resp.status() === 200),
      page.goto("/tickets"),
    ]);

    const titleLink = page.getByRole("link", { name: "Network Issue Troubleshooting" });
    await expect(titleLink).toBeVisible();

    await Promise.all([
      page.waitForResponse((resp) => resp.url().includes(`/api/tickets/${ticketId}`)),
      titleLink.click(),
    ]);

    await expect(page).toHaveURL(new RegExp(`/tickets/${ticketId}`));
    await expect(page.getByRole("heading", { name: "Network Issue Troubleshooting" })).toBeVisible();
  });

  test("navigating to a non-existent ticketId shows an error message", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/tickets/TKT-9999");
    // React Query retries 404s (3× with exponential backoff ≈ 7 s) before setting isError
    await expect(page.getByText(/failed to load ticket/i)).toBeVisible({ timeout: 15000 });
  });
});

// ---------------------------------------------------------------------------
// Suite 3 — GET /api/tickets/assignable-users  (direct API)
// ---------------------------------------------------------------------------

test.describe("GET /api/tickets/assignable-users — API", () => {
  test("returns 401 when not authenticated", async ({ request }) => {
    const res = await request.get(`${BASE}/api/tickets/assignable-users`);
    expect(res.status()).toBe(401);
  });

  test("returns 200 with an array when authenticated", async ({ request }) => {
    await apiSignIn(request);
    const res = await request.get(`${BASE}/api/tickets/assignable-users`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  test("each user object has only id and name fields", async ({ request }) => {
    await apiSignIn(request);
    const body = await (await request.get(`${BASE}/api/tickets/assignable-users`)).json() as Record<string, unknown>[];
    expect(body.length).toBeGreaterThan(0);
    for (const user of body) {
      expect(Object.keys(user).sort()).toEqual(["id", "name"]);
    }
  });
});

// ---------------------------------------------------------------------------
// Suite 4 — PATCH /api/tickets/:id/assignee  (direct API)
// ---------------------------------------------------------------------------

test.describe("PATCH /api/tickets/:id/assignee — API", () => {
  let ticketId: string;

  test.beforeAll(async ({ request }) => {
    ticketId = await seedTicket(request, { subject: "Assignee API test ticket" });
  });

  test("returns 401 when not authenticated", async ({ request }) => {
    const res = await request.patch(`${BASE}/api/tickets/${ticketId}/assignee`, {
      data:    { assignedToId: null },
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status()).toBe(401);
  });

  test("assigns a user and returns 200 with updated ticket", async ({ request }) => {
    await apiSignIn(request);
    const users = await (await request.get(`${BASE}/api/tickets/assignable-users`)).json() as { id: string; name: string }[];
    const userId = users[0].id;

    const res = await request.patch(`${BASE}/api/tickets/${ticketId}/assignee`, {
      data:    { assignedToId: userId },
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status()).toBe(200);
    const ticket = await res.json();
    expect(ticket.assignedTo).not.toBeNull();
    expect(ticket.assignedTo.id).toBe(userId);
  });

  test("unassigns a ticket when assignedToId is null and returns 200", async ({ request }) => {
    await apiSignIn(request);
    const res = await request.patch(`${BASE}/api/tickets/${ticketId}/assignee`, {
      data:    { assignedToId: null },
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status()).toBe(200);
    const ticket = await res.json();
    expect(ticket.assignedTo).toBeNull();
  });

  test("returns 400 when assignedToId field is missing from body", async ({ request }) => {
    await apiSignIn(request);
    const res = await request.patch(`${BASE}/api/tickets/${ticketId}/assignee`, {
      data:    {},
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status()).toBe(400);
  });

  test("returns 400 when assignedToId is not a valid UUID", async ({ request }) => {
    await apiSignIn(request);
    const res = await request.patch(`${BASE}/api/tickets/${ticketId}/assignee`, {
      data:    { assignedToId: "not-a-uuid" },
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status()).toBe(400);
  });

  test("returns 404 when the user ID does not exist", async ({ request }) => {
    await apiSignIn(request);
    const res = await request.patch(`${BASE}/api/tickets/${ticketId}/assignee`, {
      data:    { assignedToId: "00000000-0000-0000-0000-000000000000" },
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status()).toBe(404);
  });

  test("returns 404 for a non-existent ticketId", async ({ request }) => {
    await apiSignIn(request);
    const res = await request.patch(`${BASE}/api/tickets/TKT-9999/assignee`, {
      data:    { assignedToId: null },
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status()).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Suite 5 — Assign ticket UI  (e2e)
// ---------------------------------------------------------------------------

test.describe("Assign ticket — UI", () => {
  // assignTicketId is used for tests 1-3 (assign flow)
  // unassignTicketId is a fresh ticket for test 4 (unassign flow) so
  // it always starts unassigned regardless of other test ordering
  let assignTicketId: string;
  let unassignTicketId: string;

  test.beforeAll(async ({ request }) => {
    assignTicketId  = await seedTicket(request, { subject: "UI assign test ticket" });
    unassignTicketId = await seedTicket(request, { subject: "UI unassign test ticket" });
  });

  // Helper: scope the Assignee trigger by its label row so adding new selects
  // elsewhere (e.g. the "Replying as" picker in the reply form) doesn't break it.
  const assigneeTrigger = (page: Page) =>
    page.locator("text=Assigned to").locator("..").locator('[data-slot="select-trigger"]');

  test("selecting a user calls PATCH and updates the dropdown", async ({ page }) => {
    await loginAsAdmin(page);
    await gotoDetail(page, assignTicketId);

    await assigneeTrigger(page).click();
    const firstUserOption = page.locator('[data-slot="select-item"]').nth(1);
    const userName = (await firstUserOption.textContent()) ?? "";

    const [patchRes] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes(`/api/tickets/${assignTicketId}/assignee`) && r.request().method() === "PATCH",
      ),
      firstUserOption.click(),
    ]);

    expect(patchRes.status()).toBe(200);
    await expect(assigneeTrigger(page)).toContainText(userName.trim(), { timeout: 5000 });
  });

  test("selecting Unassigned sends null and clears the dropdown", async ({ page }) => {
    await loginAsAdmin(page);
    // Use a fresh ticket (unassigned) so the first PATCH is guaranteed to fire
    await gotoDetail(page, unassignTicketId);

    // Step 1: assign someone
    await assigneeTrigger(page).click();
    const [assignRes] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes(`/api/tickets/${unassignTicketId}/assignee`) && r.request().method() === "PATCH",
      ),
      page.locator('[data-slot="select-item"]').nth(1).click(),
    ]);
    expect(assignRes.status()).toBe(200);

    // Step 2: unassign
    await assigneeTrigger(page).click();
    const [unassignRes] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes(`/api/tickets/${unassignTicketId}/assignee`) && r.request().method() === "PATCH",
      ),
      page.locator('[data-slot="select-item"]').first().click(),
    ]);
    expect(unassignRes.status()).toBe(200);

    await expect(assigneeTrigger(page)).toContainText("Unassigned", { timeout: 5000 });
  });
});

// ---------------------------------------------------------------------------
// Suite 6 — PATCH /api/tickets/:id/status  (direct API)
// ---------------------------------------------------------------------------

test.describe("PATCH /api/tickets/:id/status — API", () => {
  let ticketId: string;

  test.beforeAll(async ({ request }) => {
    ticketId = await seedTicket(request, { subject: "Status API test ticket" });
  });

  test("returns 401 when not authenticated", async ({ request }) => {
    const res = await request.patch(`${BASE}/api/tickets/${ticketId}/status`, {
      data:    { status: "IN_PROGRESS" },
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status()).toBe(401);
  });

  test("updates status and returns 200 with updated ticket", async ({ request }) => {
    await apiSignIn(request);
    const res = await request.patch(`${BASE}/api/tickets/${ticketId}/status`, {
      data:    { status: "OPEN_IN_PROGRESS" },
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status()).toBe(200);
    const ticket = await res.json();
    expect(ticket.status).toBe("OPEN_IN_PROGRESS");
  });

  test("returns 400 for an invalid status value", async ({ request }) => {
    await apiSignIn(request);
    const res = await request.patch(`${BASE}/api/tickets/${ticketId}/status`, {
      data:    { status: "INVALID_STATUS" },
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status()).toBe(400);
  });

  test("returns 400 when status field is missing", async ({ request }) => {
    await apiSignIn(request);
    const res = await request.patch(`${BASE}/api/tickets/${ticketId}/status`, {
      data:    {},
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status()).toBe(400);
  });

  test("returns 404 for a non-existent ticketId", async ({ request }) => {
    await apiSignIn(request);
    const res = await request.patch(`${BASE}/api/tickets/TKT-9999/status`, {
      data:    { status: "OPEN_IN_PROGRESS" },
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status()).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Suite 7 — PATCH /api/tickets/:id/type  (direct API)
// ---------------------------------------------------------------------------

test.describe("PATCH /api/tickets/:id/type — API", () => {
  let ticketId: string;

  test.beforeAll(async ({ request }) => {
    ticketId = await seedTicket(request, { subject: "Type API test ticket" });
  });

  test("returns 401 when not authenticated", async ({ request }) => {
    const res = await request.patch(`${BASE}/api/tickets/${ticketId}/type`, {
      data:    { type: "BUG" },
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status()).toBe(401);
  });

  test("updates type and returns 200 with updated ticket", async ({ request }) => {
    await apiSignIn(request);
    const res = await request.patch(`${BASE}/api/tickets/${ticketId}/type`, {
      data:    { type: "BUG" },
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status()).toBe(200);
    const ticket = await res.json();
    expect(ticket.type).toBe("BUG");
  });

  test("returns 400 for an invalid type value", async ({ request }) => {
    await apiSignIn(request);
    const res = await request.patch(`${BASE}/api/tickets/${ticketId}/type`, {
      data:    { type: "NOT_A_TYPE" },
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status()).toBe(400);
  });

  test("returns 400 when type field is missing", async ({ request }) => {
    await apiSignIn(request);
    const res = await request.patch(`${BASE}/api/tickets/${ticketId}/type`, {
      data:    {},
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status()).toBe(400);
  });

  test("returns 404 for a non-existent ticketId", async ({ request }) => {
    await apiSignIn(request);
    const res = await request.patch(`${BASE}/api/tickets/TKT-9999/type`, {
      data:    { type: "TASK" },
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status()).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Suite 8 — Update status UI  (e2e)
// ---------------------------------------------------------------------------

test.describe("Update status — UI", () => {
  let statusTicketId: string;

  test.beforeAll(async ({ request }) => {
    statusTicketId = await seedTicket(request, { subject: "UI status update test ticket" });
  });

  test("selecting a new status calls PATCH /status and updates the trigger", async ({ page }) => {
    await loginAsAdmin(page);
    await gotoDetail(page, statusTicketId);

    // Find the Status trigger specifically by its label row
    const statusRow = page.locator("text=Status").locator("..");
    const statusTrigger = statusRow.locator('[data-slot="select-trigger"]');
    await statusTrigger.click();

    // Pick "In Progress" (second item in the status list, after "Open")
    const items = page.locator('[data-slot="select-item"]');
    const inProgressOption = items.filter({ hasText: "In Progress" }).first();

    const [patchRes] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes(`/api/tickets/${statusTicketId}/status`) && r.request().method() === "PATCH",
      ),
      inProgressOption.click(),
    ]);

    expect(patchRes.status()).toBe(200);
    await expect(statusTrigger).toContainText("In Progress", { timeout: 5000 });
  });

  test("Status trigger reflects the current value from the server", async ({ page }) => {
    await loginAsAdmin(page);
    await gotoDetail(page, statusTicketId);
    const statusRow = page.locator("text=Status").locator("..");
    const statusTrigger = statusRow.locator('[data-slot="select-trigger"]');
    // Previous test moved status to "In Progress"
    await expect(statusTrigger).toContainText("In Progress");
  });
});

// ---------------------------------------------------------------------------
// Suite 9 — Update type/category UI  (e2e)
// ---------------------------------------------------------------------------

test.describe("Update category — UI", () => {
  let typeTicketId: string;

  test.beforeAll(async ({ request }) => {
    typeTicketId = await seedTicket(request, { subject: "UI type update test ticket" });
  });

  test("selecting a new category calls PATCH /type and updates the trigger", async ({ page }) => {
    await loginAsAdmin(page);
    await gotoDetail(page, typeTicketId);

    const categoryRow = page.locator("text=Category").locator("..");
    const categoryTrigger = categoryRow.locator('[data-slot="select-trigger"]');
    await categoryTrigger.click();

    const items = page.locator('[data-slot="select-item"]');
    const bugOption = items.filter({ hasText: "Bug" }).first();

    const [patchRes] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes(`/api/tickets/${typeTicketId}/type`) && r.request().method() === "PATCH",
      ),
      bugOption.click(),
    ]);

    expect(patchRes.status()).toBe(200);
    await expect(categoryTrigger).toContainText("Bug", { timeout: 5000 });
  });

  test("Category trigger reflects the current value from the server", async ({ page }) => {
    await loginAsAdmin(page);
    await gotoDetail(page, typeTicketId);
    const categoryRow = page.locator("text=Category").locator("..");
    const categoryTrigger = categoryRow.locator('[data-slot="select-trigger"]');
    // Previous test moved category to "Bug"
    await expect(categoryTrigger).toContainText("Bug");
  });
});

// ---------------------------------------------------------------------------
// Suite 10 — GET /api/tickets/:id/comments  (direct API)
// ---------------------------------------------------------------------------

test.describe("GET /api/tickets/:id/comments — API", () => {
  let ticketId: string;

  test.beforeAll(async ({ request }) => {
    ticketId = await seedTicket(request, { subject: "Comments GET API test ticket" });
  });

  test("returns 401 when not authenticated", async ({ request }) => {
    const res = await request.get(`${BASE}/api/tickets/${ticketId}/comments`);
    expect(res.status()).toBe(401);
  });

  test("returns 200 with empty array for a new ticket", async ({ request }) => {
    await apiSignIn(request);
    const res = await request.get(`${BASE}/api/tickets/${ticketId}/comments`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBe(0);
  });

  test("returns array with comment after one is posted", async ({ request }) => {
    await apiSignIn(request);
    await request.post(`${BASE}/api/tickets/${ticketId}/comments`, {
      data:    { content: "Test comment for GET suite", senderType: "AGENT" },
      headers: { "Content-Type": "application/json" },
    });

    const res = await request.get(`${BASE}/api/tickets/${ticketId}/comments`);
    expect(res.status()).toBe(200);
    const body = await res.json() as Record<string, unknown>[];
    expect(body.length).toBeGreaterThanOrEqual(1);
  });

  test("each comment object has id, content, senderType, author (id + name), and createdAt", async ({ request }) => {
    await apiSignIn(request);
    const body = await (await request.get(`${BASE}/api/tickets/${ticketId}/comments`)).json() as Record<string, unknown>[];
    expect(body.length).toBeGreaterThan(0);
    const comment = body[0] as { author: Record<string, unknown> };
    expect(comment).toHaveProperty("id");
    expect(comment).toHaveProperty("content");
    expect(comment).toHaveProperty("senderType");
    expect(comment).toHaveProperty("createdAt");
    expect(comment).toHaveProperty("author");
    expect(comment.author).toHaveProperty("id");
    expect(comment.author).toHaveProperty("name");
  });

  test("returns 404 for a non-existent ticketId", async ({ request }) => {
    await apiSignIn(request);
    const res = await request.get(`${BASE}/api/tickets/TKT-9999/comments`);
    expect(res.status()).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Suite 11 — POST /api/tickets/:id/comments  (direct API)
// ---------------------------------------------------------------------------

test.describe("POST /api/tickets/:id/comments — API", () => {
  let ticketId: string;

  test.beforeAll(async ({ request }) => {
    ticketId = await seedTicket(request, { subject: "Comments POST API test ticket" });
  });

  test("returns 401 when not authenticated", async ({ request }) => {
    const res = await request.post(`${BASE}/api/tickets/${ticketId}/comments`, {
      data:    { content: "hello", senderType: "AGENT" },
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status()).toBe(401);
  });

  test("201 creates comment and response has all required fields", async ({ request }) => {
    await apiSignIn(request);
    const res = await request.post(`${BASE}/api/tickets/${ticketId}/comments`, {
      data:    { content: "My first comment", senderType: "AGENT" },
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status()).toBe(201);
    const body = await res.json() as Record<string, unknown> & { author: Record<string, unknown> };
    expect(body).toHaveProperty("id");
    expect(body).toHaveProperty("content");
    expect(body).toHaveProperty("senderType");
    expect(body).toHaveProperty("createdAt");
    expect(body).toHaveProperty("author");
    expect(body.author).toHaveProperty("id");
    expect(body.author).toHaveProperty("name");
  });

  test("senderType is always AGENT for authenticated admin/agent (server-derived)", async ({ request }) => {
    await apiSignIn(request);
    const res = await request.post(`${BASE}/api/tickets/${ticketId}/comments`, {
      data:    { content: "Reply with ignored senderType", senderType: "CUSTOMER" },
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status()).toBe(201);
    const body = await res.json() as { senderType: string };
    // senderType is derived from session role — client value is ignored
    expect(body.senderType).toBe("AGENT");
  });

  test("senderType defaults to AGENT when not provided", async ({ request }) => {
    await apiSignIn(request);
    const res = await request.post(`${BASE}/api/tickets/${ticketId}/comments`, {
      data:    { content: "Agent reply without senderType" },
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status()).toBe(201);
    const body = await res.json() as { senderType: string };
    expect(body.senderType).toBe("AGENT");
  });

  test("returns 400 when content is empty string", async ({ request }) => {
    await apiSignIn(request);
    const res = await request.post(`${BASE}/api/tickets/${ticketId}/comments`, {
      data:    { content: "", senderType: "AGENT" },
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status()).toBe(400);
  });

  test("returns 400 when content field is missing", async ({ request }) => {
    await apiSignIn(request);
    const res = await request.post(`${BASE}/api/tickets/${ticketId}/comments`, {
      data:    { senderType: "AGENT" },
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status()).toBe(400);
  });

  test("returns 404 for a non-existent ticketId", async ({ request }) => {
    await apiSignIn(request);
    const res = await request.post(`${BASE}/api/tickets/TKT-9999/comments`, {
      data:    { content: "hello", senderType: "AGENT" },
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status()).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Suite 12 — Replies UI  (e2e)
// ---------------------------------------------------------------------------

test.describe("Replies — UI", () => {
  let replyTicketId: string;

  test.beforeAll(async ({ request }) => {
    replyTicketId = await seedTicket(request, { subject: "UI reply test ticket" });
  });

  test("typing content and clicking Post Reply sends POST and reply appears in thread", async ({ page }) => {
    await loginAsAdmin(page);
    await gotoDetail(page, replyTicketId);

    await page.getByPlaceholder("Write a reply…").fill("This is my test reply.");

    const [postRes] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes(`/api/tickets/${replyTicketId}/comments`) && r.request().method() === "POST",
      ),
      page.getByRole("button", { name: "Post Reply" }).click(),
    ]);

    expect(postRes.status()).toBe(201);
    await expect(page.getByText("This is my test reply.")).toBeVisible({ timeout: 5000 });
  });

  test("reply count appears in heading after posting", async ({ page }) => {
    await loginAsAdmin(page);
    await gotoDetail(page, replyTicketId);
    // Previous test posted one reply — heading should show "Replies (1)"
    await expect(page.getByText(/Replies \(\d+\)/)).toBeVisible();
  });

  test("Agent badge is shown for an agent reply", async ({ page }) => {
    await loginAsAdmin(page);
    await gotoDetail(page, replyTicketId);
    await expect(page.locator('[data-slot="badge"]', { hasText: "Agent" })).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Suite 13 — Polish API  (api)
// ---------------------------------------------------------------------------

test.describe("Polish — API", () => {
  let polishTicketId: string;

  test.beforeAll(async ({ request }) => {
    polishTicketId = await seedTicket(request, { subject: "Polish API test ticket" });
  });

  test("401 when not authenticated", async ({ request }) => {
    const res = await request.post(`${BASE}/api/tickets/${polishTicketId}/polish`, {
      data:    { content: "hello" },
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status()).toBe(401);
  });

  test("400 for empty content", async ({ request }) => {
    const cookie = await apiSignIn(request);
    const res = await request.post(`${BASE}/api/tickets/${polishTicketId}/polish`, {
      data:    { content: "" },
      headers: { "Content-Type": "application/json", Cookie: cookie },
    });
    expect(res.status()).toBe(400);
  });

  test("authenticated request reaches the AI endpoint (200 or 502 if Kimi unavailable)", async ({ request }) => {
    const cookie = await apiSignIn(request);
    const res = await request.post(`${BASE}/api/tickets/${polishTicketId}/polish`, {
      data:    { content: "thanks for your message we will look into it" },
      headers: { "Content-Type": "application/json", Cookie: cookie },
    });
    // 200 = Kimi responded; 502 = Kimi unreachable in this env — both are valid outcomes
    expect([200, 502]).toContain(res.status());
    const body = await res.json();
    if (res.status() === 200) {
      expect(typeof body.polished).toBe("string");
      expect(body.polished.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Suite 14 — Polish UI  (e2e)
// ---------------------------------------------------------------------------

test.describe("Polish — UI", () => {
  let polishUiTicketId: string;

  test.beforeAll(async ({ request }) => {
    polishUiTicketId = await seedTicket(request, { subject: "Polish UI test ticket" });
  });

  test("Polish button is disabled when textarea is empty", async ({ page }) => {
    await loginAsAdmin(page);
    await gotoDetail(page, polishUiTicketId);
    const polishBtn = page.getByRole("button", { name: /Polish/ });
    await expect(polishBtn).toBeDisabled();
  });

  test("Polish button is enabled when textarea has content", async ({ page }) => {
    await loginAsAdmin(page);
    await gotoDetail(page, polishUiTicketId);
    await page.getByPlaceholder("Write a reply…").fill("fix this");
    const polishBtn = page.getByRole("button", { name: /Polish/ });
    await expect(polishBtn).toBeEnabled();
  });
});

// ---------------------------------------------------------------------------
// Suite 12 — New enum values: WAITING_FOR_CLIENT status + EXPLANATION type
// ---------------------------------------------------------------------------

test.describe("New enum values — status & type", () => {
  let newEnumTicketId: string;

  test.beforeAll(async ({ request }) => {
    await apiSignIn(request);
    newEnumTicketId = await seedTicket(request, { subject: "New enum values test" });
  });

  test("PATCH /status accepts WAITING_FOR_CLIENT via API", async ({ request }) => {
    await apiSignIn(request);
    const res = await request.patch(`${BASE}/api/tickets/${newEnumTicketId}/status`, {
      data: { status: "WAITING_FOR_CLIENT" },
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("WAITING_FOR_CLIENT");
  });

  test("PATCH /type accepts EXPLANATION via API", async ({ request }) => {
    await apiSignIn(request);
    const res = await request.patch(`${BASE}/api/tickets/${newEnumTicketId}/type`, {
      data: { type: "EXPLANATION" },
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.type).toBe("EXPLANATION");
  });

  test("Waiting for Client appears as option in tickets list status filter", async ({ page }) => {
    // Use the status filter dropdown on the tickets list — simpler and reliable
    await page.route(/\/api\/tickets(\?.*)?$/, (route) =>
      route.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify({ data: [], total: 0, page: 1, pageSize: 10, totalPages: 0 }) })
    );
    await loginAsAdmin(page);
    await page.goto("/tickets");
    await expect(page.getByRole("heading", { name: "Tickets" })).toBeVisible();
    // Open the status filter Select and look for the new option
    await page.getByText("All statuses").click();
    await expect(page.getByText("Waiting for Client")).toBeVisible();
  });

  test("Explanation appears as option in tickets list category filter", async ({ page }) => {
    await page.route(/\/api\/tickets(\?.*)?$/, (route) =>
      route.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify({ data: [], total: 0, page: 1, pageSize: 10, totalPages: 0 }) })
    );
    await loginAsAdmin(page);
    await page.goto("/tickets");
    await expect(page.getByRole("heading", { name: "Tickets" })).toBeVisible();
    // Open the category filter Select and look for the new option
    await page.getByText("All categories").click();
    await expect(page.getByText("Explanation")).toBeVisible();
  });
});
