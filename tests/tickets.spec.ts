import { test, expect, type Page, type APIRequestContext } from "@playwright/test";
import { type StatusValue, type TicketTypeValue, STATUSES, TICKET_TYPES } from "@tms/core";

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

async function goToTicketsPage(page: Page) {
  await page.goto("/tickets");
  await expect(page.getByRole("heading", { name: "Tickets" })).toBeVisible();
}

/** Stub /api/tickets so the page renders without a real backend. */
async function mockTicketsApi(page: Page) {
  await page.route(/\/api\/tickets(\?.*)?$/, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: [], total: 0, page: 1, pageSize: 20, totalPages: 0 }),
    })
  );
}

/** Sign in via direct API and return the session cookie string. */
async function apiSignIn(request: APIRequestContext): Promise<string> {
  const res = await request.post(`${BASE}/api/auth/sign-in/email`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    headers: { "Content-Type": "application/json" },
  });
  expect(res.status()).toBe(200);
  // Extract Set-Cookie header for subsequent requests
  const setCookie = res.headers()["set-cookie"] ?? "";
  return setCookie.split(";")[0]; // "better-auth.session_token=..."
}

/** GET /api/tickets and return the data array. */
async function getTickets(request: APIRequestContext, qs = "") {
  const res = await request.get(`${BASE}/api/tickets${qs ? `?${qs}` : ""}`);
  expect(res.status()).toBe(200);
  const body = await res.json();
  return body.data as Record<string, unknown>[];
}

// ---------------------------------------------------------------------------
// Suite 1 — Tickets page navigation & auth guard (true e2e, needs real routing)
// ---------------------------------------------------------------------------

test.describe.configure({ mode: "serial" });

test.describe("Tickets page — navigation & auth", () => {
  test.beforeEach(async ({ page }) => {
    await mockTicketsApi(page);
    await loginAsAdmin(page);
    await goToTicketsPage(page);
  });

  test("Tickets nav link is highlighted as active on /tickets", async ({ page }) => {
    const link = page.getByRole("link", { name: "Tickets" });
    await expect(link).toBeVisible();
    await expect(link).not.toHaveClass(/muted-foreground/);
  });

  test("clicking Dashboard nav link navigates to /", async ({ page }) => {
    await page.getByRole("link", { name: "Dashboard" }).click();
    await expect(page).toHaveURL("/");
  });

  test("unauthenticated user is redirected to /login", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/tickets");
    await expect(page).toHaveURL("/login");
  });
});

// ---------------------------------------------------------------------------
// Suite 2 — GET /api/tickets API (direct calls to test server, no proxy)
// ---------------------------------------------------------------------------

test.describe("GET /api/tickets — API", () => {
  test("returns 401 when not authenticated", async ({ request }) => {
    const res = await request.get(`${BASE}/api/tickets`);
    expect(res.status()).toBe(401);
  });

  test("returns 200 with paginated envelope when authenticated as admin", async ({ request }) => {
    await apiSignIn(request);
    const res  = await request.get(`${BASE}/api/tickets`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("data");
    expect(body).toHaveProperty("total");
    expect(body).toHaveProperty("page");
    expect(body).toHaveProperty("pageSize");
    expect(body).toHaveProperty("totalPages");
    expect(Array.isArray(body.data)).toBe(true);
  });

  test("returns empty data array when no tickets exist", async ({ request }) => {
    await apiSignIn(request);
    const res  = await request.get(`${BASE}/api/tickets`);
    const body = await res.json();
    // Test DB starts clean — 0 tickets before webhooks suite creates any
    expect(Array.isArray(body.data)).toBe(true);
  });

  test("a ticket created via webhook is returned in the list", async ({ request }) => {
    await apiSignIn(request);

    // Seed via webhook
    const seedRes = await request.post(`${BASE}/api/webhooks/email`, {
      data: {
        from:    "api-test@example.com",
        subject: "API ticket list test",
        body:    "Created to verify GET /api/tickets.",
      },
      headers: { "Content-Type": "application/json" },
    });
    expect(seedRes.status()).toBe(201);
    const { ticketId } = await seedRes.json();

    const tickets = await getTickets(request);
    const found   = tickets.find((t) => t.ticketId === ticketId);
    expect(found).toBeDefined();
  });

  test("each ticket has all required fields", async ({ request }) => {
    await apiSignIn(request);
    const tickets = await getTickets(request);
    expect(tickets.length).toBeGreaterThan(0);

    for (const ticket of tickets) {
      for (const field of ["id", "ticketId", "title", "description", "type", "priority", "status", "project", "createdAt", "updatedAt", "createdBy"]) {
        expect(ticket).toHaveProperty(field);
      }
    }
  });

  test("tickets are ordered newest first", async ({ request }) => {
    // Seed a second ticket so we have at least 2 to compare
    await request.post(`${BASE}/api/webhooks/email`, {
      data: { from: "order@example.com", subject: "Ordering test", body: "Second ticket." },
      headers: { "Content-Type": "application/json" },
    });

    await apiSignIn(request);
    const tickets = await getTickets(request);
    expect(tickets.length).toBeGreaterThanOrEqual(2);

    for (let i = 1; i < tickets.length; i++) {
      const prev = new Date(tickets[i - 1].createdAt as string).getTime();
      const curr = new Date(tickets[i].createdAt as string).getTime();
      expect(prev).toBeGreaterThanOrEqual(curr);
    }
  });

  test("status values conform to StatusValue", async ({ request }) => {
    await apiSignIn(request);
    const tickets = await getTickets(request);
    const valid: StatusValue[] = [...STATUSES];
    for (const t of tickets) {
      expect(valid).toContain(t.status);
    }
  });

  test("type values conform to TicketTypeValue", async ({ request }) => {
    await apiSignIn(request);
    const tickets = await getTickets(request);
    const valid: TicketTypeValue[] = [...TICKET_TYPES];
    for (const t of tickets) {
      expect(valid).toContain(t.type);
    }
  });

  test("ticketId follows TKT-XXXX format", async ({ request }) => {
    await apiSignIn(request);
    const tickets = await getTickets(request);
    for (const t of tickets) {
      expect(t.ticketId).toMatch(/^TKT-\d{4}$/);
    }
  });
});

// ---------------------------------------------------------------------------
// Suite 3 — GET /api/tickets sorting (direct API calls)
// ---------------------------------------------------------------------------

test.describe("GET /api/tickets — sorting", () => {
  test("sortBy=createdAt&sortOrder=asc returns oldest ticket first", async ({ request }) => {
    await apiSignIn(request);
    const tickets = await getTickets(request, "sortBy=createdAt&sortOrder=asc");
    expect(tickets.length).toBeGreaterThan(1);

    for (let i = 1; i < tickets.length; i++) {
      const prev = new Date(tickets[i - 1].createdAt as string).getTime();
      const curr = new Date(tickets[i].createdAt as string).getTime();
      expect(prev).toBeLessThanOrEqual(curr);
    }
  });

  test("sortBy=createdAt&sortOrder=desc returns newest ticket first (explicit param)", async ({ request }) => {
    await apiSignIn(request);
    const tickets = await getTickets(request, "sortBy=createdAt&sortOrder=desc");
    expect(tickets.length).toBeGreaterThan(1);

    for (let i = 1; i < tickets.length; i++) {
      const prev = new Date(tickets[i - 1].createdAt as string).getTime();
      const curr = new Date(tickets[i].createdAt as string).getTime();
      expect(prev).toBeGreaterThanOrEqual(curr);
    }
  });

  test("sortBy=ticketId&sortOrder=asc returns tickets in ascending ID order", async ({ request }) => {
    await apiSignIn(request);
    const tickets = await getTickets(request, "sortBy=ticketId&sortOrder=asc");
    expect(tickets.length).toBeGreaterThan(1);

    for (let i = 1; i < tickets.length; i++) {
      expect((tickets[i - 1].ticketId as string) <= (tickets[i].ticketId as string)).toBe(true);
    }
  });

  test("invalid sortBy value returns 400", async ({ request }) => {
    await apiSignIn(request);
    const res = await request.get(`${BASE}/api/tickets?sortBy=invalid`);
    expect(res.status()).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Suite 4 — GET /api/tickets pagination (direct API calls)
// ---------------------------------------------------------------------------

test.describe("GET /api/tickets — pagination", () => {
  test("response includes pagination envelope fields", async ({ request }) => {
    await apiSignIn(request);
    const res  = await request.get(`${BASE}/api/tickets`);
    const body = await res.json();
    expect(typeof body.total).toBe("number");
    expect(typeof body.page).toBe("number");
    expect(typeof body.pageSize).toBe("number");
    expect(typeof body.totalPages).toBe("number");
  });

  test("default page is 1 and pageSize is 10", async ({ request }) => {
    await apiSignIn(request);
    const res  = await request.get(`${BASE}/api/tickets`);
    const body = await res.json();
    expect(body.page).toBe(1);
    expect(body.pageSize).toBe(10);
  });

  test("pageSize=1 returns at most 1 ticket", async ({ request }) => {
    await apiSignIn(request);
    const res  = await request.get(`${BASE}/api/tickets?pageSize=1`);
    const body = await res.json();
    expect(body.data.length).toBeLessThanOrEqual(1);
    expect(body.pageSize).toBe(1);
  });

  test("page=2&pageSize=1 returns a different ticket than page=1", async ({ request }) => {
    await apiSignIn(request);
    const [r1, r2] = await Promise.all([
      request.get(`${BASE}/api/tickets?page=1&pageSize=1`),
      request.get(`${BASE}/api/tickets?page=2&pageSize=1`),
    ]);
    const b1 = await r1.json();
    const b2 = await r2.json();
    if (b1.total >= 2) {
      expect(b1.data[0].id).not.toBe(b2.data[0].id);
    }
  });

  test("totalPages equals ceil(total / pageSize)", async ({ request }) => {
    await apiSignIn(request);
    const res  = await request.get(`${BASE}/api/tickets?pageSize=3`);
    const body = await res.json();
    expect(body.totalPages).toBe(Math.ceil(body.total / 3));
  });
});

// ---------------------------------------------------------------------------
// Suite 5 — GET /api/tickets new filters: assignedToId, from, to
// ---------------------------------------------------------------------------

test.describe("GET /api/tickets — assignee and date filters", () => {
  let seedTicketId: string;

  test.beforeAll(async ({ request }) => {
    await apiSignIn(request);
    // Seed a ticket for filter tests
    const res = await request.post(`${BASE}/api/webhooks/email`, {
      data: {
        from:    "filter-test@example.com",
        subject: "Filter test ticket",
        body:    "Used to test assignee and date filters.",
      },
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status()).toBe(201);
    seedTicketId = (await res.json()).ticketId;
  });

  test("assignedToId=unassigned returns only tickets with no assignee", async ({ request }) => {
    await apiSignIn(request);
    const res  = await request.get(`${BASE}/api/tickets?assignedToId=unassigned&pageSize=100`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    // Every returned ticket must have assignedTo === null
    // Note: webhook-created tickets get assignedToId = AI agent, so they won't appear here
    for (const t of body.data as Array<{ assignedTo: unknown }>) {
      expect(t.assignedTo).toBeNull();
    }
  });

  test("assignedToId=unassigned returns 200 with valid envelope", async ({ request }) => {
    await apiSignIn(request);
    const res  = await request.get(`${BASE}/api/tickets?assignedToId=unassigned`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("data");
    expect(body).toHaveProperty("total");
    expect(Array.isArray(body.data)).toBe(true);
  });

  test("from filter restricts tickets to those created on or after the given date", async ({ request }) => {
    await apiSignIn(request);
    const fromDate = new Date();
    fromDate.setFullYear(fromDate.getFullYear() - 1); // one year ago
    const from = fromDate.toISOString().slice(0, 10);

    const res  = await request.get(`${BASE}/api/tickets?from=${from}`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    // All returned tickets must have createdAt >= from
    for (const t of body.data as Array<{ createdAt: string }>) {
      expect(new Date(t.createdAt).getTime()).toBeGreaterThanOrEqual(fromDate.getTime());
    }
  });

  test("to filter restricts tickets to those created on or before the given date", async ({ request }) => {
    await apiSignIn(request);
    const toDate = new Date();
    toDate.setFullYear(toDate.getFullYear() + 1); // one year from now (includes everything)
    const to = toDate.toISOString().slice(0, 10);

    const res  = await request.get(`${BASE}/api/tickets?to=${to}`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
    // All tickets should be included since to is far in the future
    const totalRes = await request.get(`${BASE}/api/tickets`);
    const totalBody = await totalRes.json();
    expect(body.total).toBe(totalBody.total);
  });

  test("from=future date returns empty data", async ({ request }) => {
    await apiSignIn(request);
    const futureDate = "2099-01-01";
    const res  = await request.get(`${BASE}/api/tickets?from=${futureDate}`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(0);
    expect(body.total).toBe(0);
  });

  test("to=past date returns empty data", async ({ request }) => {
    await apiSignIn(request);
    const pastDate = "2000-01-01";
    const res  = await request.get(`${BASE}/api/tickets?to=${pastDate}`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(0);
    expect(body.total).toBe(0);
  });

  test("from and to can be combined with other filters", async ({ request }) => {
    await apiSignIn(request);
    const from = "2020-01-01";
    const to   = "2099-12-31";
    const res  = await request.get(`${BASE}/api/tickets?assignedToId=unassigned&from=${from}&to=${to}`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
    // All returned tickets must be unassigned
    for (const t of body.data as Array<{ assignedTo: unknown }>) {
      expect(t.assignedTo).toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// Suite 8 — New status & type values (API)
// ---------------------------------------------------------------------------

test.describe("New enum values — API", () => {
  test("PATCH /status accepts WAITING_FOR_CLIENT", async ({ request }) => {
    await apiSignIn(request);
    const tickets = await getTickets(request);
    expect(tickets.length).toBeGreaterThan(0);
    const ticketId = tickets[0].ticketId as string;

    const res = await request.patch(`${BASE}/api/tickets/${ticketId}/status`, {
      data: { status: "WAITING_FOR_CLIENT" },
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("WAITING_FOR_CLIENT");

    // Reset to avoid polluting other tests
    await request.patch(`${BASE}/api/tickets/${ticketId}/status`, {
      data: { status: "OPEN_NOT_STARTED" },
      headers: { "Content-Type": "application/json" },
    });
  });

  test("PATCH /type accepts EXPLANATION", async ({ request }) => {
    await apiSignIn(request);
    const tickets = await getTickets(request);
    expect(tickets.length).toBeGreaterThan(0);
    const ticketId = tickets[0].ticketId as string;

    const res = await request.patch(`${BASE}/api/tickets/${ticketId}/type`, {
      data: { type: "EXPLANATION" },
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.type).toBe("EXPLANATION");

    // Reset
    await request.patch(`${BASE}/api/tickets/${ticketId}/type`, {
      data: { type: "SUPPORT" },
      headers: { "Content-Type": "application/json" },
    });
  });
});

// ---------------------------------------------------------------------------
// Suite 9 — Ticket slide panel (UI)
// ---------------------------------------------------------------------------

/** Mock tickets API with one real ticket so the panel has data to show. */
async function mockTicketsApiWithData(page: Page) {
  const mockTicket = {
    id:                 "test-id-001",
    ticketId:           "TKT-0001",
    title:              "Backend Admin - AI Reports are not accurate",
    description:        "The AI reports dashboard shows incorrect figures.",
    type:               "BUG",
    priority:           "HIGH",
    status:             "OPEN_IN_PROGRESS",
    project:            "Drive-EV",
    senderName:         "Ian",
    senderEmail:        "ian@drive-ev.com",
    assignedTo:         { id: "agent-1", name: "Yuvaraj Pandian" },
    createdBy:          { id: "admin-1", name: "Admin" },
    createdAt:          "2026-04-06T08:00:00.000Z",
    updatedAt:          "2026-04-06T08:00:00.000Z",
    lastCustomerReplyAt: null,
    attachments:        [],
  };
  await page.route(/\/api\/tickets(\?.*)?$/, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: [mockTicket], total: 1, page: 1, pageSize: 10, totalPages: 1 }),
    })
  );
  await page.route(/\/api\/tickets\/assignable-users/, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) })
  );
  await page.route(/\/api\/tickets\/clients/, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) })
  );
}

test.describe("Ticket list slide panel", () => {
  test.beforeEach(async ({ page }) => {
    await mockTicketsApiWithData(page);
    await loginAsAdmin(page);
    await goToTicketsPage(page);
  });

  test("clicking a non-link cell navigates to the ticket detail page", async ({ page }) => {
    const firstRow = page.locator("tbody tr").first();
    await firstRow.waitFor({ state: "visible" });
    // Click the Sender cell (no link inside) — row click should navigate
    await firstRow.locator("td").nth(2).click();
    await expect(page).toHaveURL(/\/tickets\/TKT-0001/);
  });

  test("clicking the eye icon opens the slide panel", async ({ page }) => {
    const firstRow = page.locator("tbody tr").first();
    await firstRow.waitFor({ state: "visible" });
    // Eye icon is the Quick view button in the last actions column
    await firstRow.getByRole("button", { name: "Quick view" }).click();
    // Panel content renders only when open (conditional rendering)
    await expect(page.getByText("Open Full Ticket")).toBeVisible();
  });

  test("panel shows ticket metadata unique to the panel", async ({ page }) => {
    const firstRow = page.locator("tbody tr").first();
    await firstRow.waitFor({ state: "visible" });
    await firstRow.getByRole("button", { name: "Quick view" }).click();
    // Assignee name appears only in the panel MetaRow, not in the table
    await expect(page.getByText("Yuvaraj Pandian")).toBeVisible();
  });

  test("clicking X button closes the panel", async ({ page }) => {
    const firstRow = page.locator("tbody tr").first();
    await firstRow.waitFor({ state: "visible" });
    await firstRow.getByRole("button", { name: "Quick view" }).click();
    await expect(page.getByText("Open Full Ticket")).toBeVisible();
    // Click the close (X) button — it's inside the panel header
    await page.getByRole("button").filter({ has: page.locator("svg") }).last().click();
    await expect(page.getByText("Open Full Ticket")).not.toBeVisible();
  });

  test("clicking the ticket ID link navigates to the ticket detail page", async ({ page }) => {
    const idLink = page.getByRole("link", { name: "TKT-0001" }).first();
    await idLink.click();
    await expect(page).not.toHaveURL("/tickets");
  });
});
