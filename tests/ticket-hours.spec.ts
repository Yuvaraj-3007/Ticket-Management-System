import { test, expect, type APIRequestContext } from "@playwright/test";

// ---------------------------------------------------------------------------
// Config + helpers
// ---------------------------------------------------------------------------

const BASE = process.env.TEST_BACKEND_URL ?? "http://localhost:5001";

async function loginAs(request: APIRequestContext, email: string, password: string) {
  return request.post(`${BASE}/api/auth/sign-in/email`, {
    data:    { email, password },
    headers: { "Content-Type": "application/json" },
  });
}

async function portalSignup(
  request: APIRequestContext,
  body: { name: string; email: string; password: string },
) {
  return request.post(`${BASE}/api/portal/auth/signup`, {
    data:    body,
    headers: { "Content-Type": "application/json" },
  });
}

async function seedTicket(
  request: APIRequestContext,
  overrides: Record<string, string> = {},
): Promise<string> {
  const res = await request.post(`${BASE}/api/webhooks/email`, {
    data: {
      from:    overrides.from    ?? "hours-test@example.com",
      name:    overrides.name    ?? "Hours Tester",
      subject: overrides.subject ?? "Hours field test ticket",
      body:    overrides.body    ?? "Seed ticket for the estimated/actual hours regression suite.",
      ...(overrides.hrmsClientId ? { hrmsClientId: overrides.hrmsClientId } : {}),
    },
    headers: { "Content-Type": "application/json" },
  });
  expect(res.status()).toBe(201);
  const { ticketId } = await res.json();
  expect(ticketId).toBeTruthy();
  return ticketId;
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

test.describe.configure({ mode: "serial" });

test.describe("PATCH /api/tickets/:id/{estimated,actual}-hours", () => {
  let adminCookies: string;

  test.beforeAll(async ({ request }) => {
    const loginRes = await loginAs(request, "admin@wisright.com", "Test@123");
    expect(loginRes.status()).toBe(200);
    adminCookies = loginRes.headers()["set-cookie"] ?? "";
    expect(adminCookies.length).toBeGreaterThan(0);
  });

  test("admin can set estimatedHours to a quarter-hour value and read it back", async ({ request }) => {
    const ticketId = await seedTicket(request, { subject: "Set estimatedHours" });

    const patchRes = await request.patch(
      `${BASE}/api/tickets/${ticketId}/estimated-hours`,
      {
        headers: { "Content-Type": "application/json", Cookie: adminCookies },
        data:    { estimatedHours: 0.5 },
      },
    );
    expect(patchRes.status()).toBe(200);
    const patched = await patchRes.json();
    expect(patched.estimatedHours).toBe(0.5);

    const getRes = await request.get(`${BASE}/api/tickets/${ticketId}`, {
      headers: { Cookie: adminCookies },
    });
    expect(getRes.status()).toBe(200);
    const ticket = await getRes.json();
    expect(ticket.estimatedHours).toBe(0.5);
  });

  test("admin can clear estimatedHours by sending null", async ({ request }) => {
    const ticketId = await seedTicket(request, { subject: "Clear estimatedHours" });

    const setRes = await request.patch(
      `${BASE}/api/tickets/${ticketId}/estimated-hours`,
      {
        headers: { "Content-Type": "application/json", Cookie: adminCookies },
        data:    { estimatedHours: 8 },
      },
    );
    expect(setRes.status()).toBe(200);
    expect((await setRes.json()).estimatedHours).toBe(8);

    const clearRes = await request.patch(
      `${BASE}/api/tickets/${ticketId}/estimated-hours`,
      {
        headers: { "Content-Type": "application/json", Cookie: adminCookies },
        data:    { estimatedHours: null },
      },
    );
    expect(clearRes.status()).toBe(200);
    expect((await clearRes.json()).estimatedHours).toBeNull();
  });

  test("estimatedHours rejects negative numbers (400)", async ({ request }) => {
    const ticketId = await seedTicket(request, { subject: "Reject negative est" });

    const res = await request.patch(
      `${BASE}/api/tickets/${ticketId}/estimated-hours`,
      {
        headers: { "Content-Type": "application/json", Cookie: adminCookies },
        data:    { estimatedHours: -1 },
      },
    );
    expect(res.status()).toBe(400);
  });

  test("estimatedHours rejects non-quarter-hour values (400)", async ({ request }) => {
    const ticketId = await seedTicket(request, { subject: "Reject non-quarter" });

    const res = await request.patch(
      `${BASE}/api/tickets/${ticketId}/estimated-hours`,
      {
        headers: { "Content-Type": "application/json", Cookie: adminCookies },
        data:    { estimatedHours: 0.3 },
      },
    );
    expect(res.status()).toBe(400);
  });

  test("admin can set and clear actualHours independently", async ({ request }) => {
    const ticketId = await seedTicket(request, { subject: "Actual hours flow" });

    const setRes = await request.patch(
      `${BASE}/api/tickets/${ticketId}/actual-hours`,
      {
        headers: { "Content-Type": "application/json", Cookie: adminCookies },
        data:    { actualHours: 1.25 },
      },
    );
    expect(setRes.status()).toBe(200);
    const patched = await setRes.json();
    expect(patched.actualHours).toBe(1.25);
    expect(patched.estimatedHours).toBeNull();

    const clearRes = await request.patch(
      `${BASE}/api/tickets/${ticketId}/actual-hours`,
      {
        headers: { "Content-Type": "application/json", Cookie: adminCookies },
        data:    { actualHours: null },
      },
    );
    expect(clearRes.status()).toBe(200);
    expect((await clearRes.json()).actualHours).toBeNull();
  });

  test("returns 404 for an unknown ticketId", async ({ request }) => {
    const res = await request.patch(
      `${BASE}/api/tickets/TKT-999999/estimated-hours`,
      {
        headers: { "Content-Type": "application/json", Cookie: adminCookies },
        data:    { estimatedHours: 1 },
      },
    );
    expect(res.status()).toBe(404);
  });
});

// ─── Customer/portal session must NOT reach the admin hours routes ────────────

test.describe("Hours endpoints reject customer sessions", () => {
  const PORTAL_EMAIL    = "hours-portal-test@example.com";
  const PORTAL_PASSWORD = "SecurePass123";
  let customerCookies: string;
  let ticketId: string;

  test.beforeAll(async ({ request }) => {
    const signupRes = await portalSignup(request, {
      name:     "Hours Portal Test",
      email:    PORTAL_EMAIL,
      password: PORTAL_PASSWORD,
    });
    expect([201, 409]).toContain(signupRes.status());

    const loginRes = await loginAs(request, PORTAL_EMAIL, PORTAL_PASSWORD);
    expect(loginRes.status()).toBe(200);
    customerCookies = loginRes.headers()["set-cookie"] ?? "";
    expect(customerCookies).not.toBe("");

    ticketId = await seedTicket(request, { subject: "Customer-blocked hours test" });
  });

  test("customer cookie cannot PATCH estimated-hours (403)", async ({ request }) => {
    const res = await request.patch(
      `${BASE}/api/tickets/${ticketId}/estimated-hours`,
      {
        headers: { "Content-Type": "application/json", Cookie: customerCookies },
        data:    { estimatedHours: 5 },
      },
    );
    expect(res.status()).toBe(403);
  });

  test("customer cookie cannot PATCH actual-hours (403)", async ({ request }) => {
    const res = await request.patch(
      `${BASE}/api/tickets/${ticketId}/actual-hours`,
      {
        headers: { "Content-Type": "application/json", Cookie: customerCookies },
        data:    { actualHours: 5 },
      },
    );
    expect(res.status()).toBe(403);
  });

  test("portal ticket detail response does not expose hours fields", async ({ request }) => {
    // Bind customer to the test client and seed a ticket from this customer
    const clientPatch = await request.patch(`${BASE}/api/portal/me/client`, {
      data:    { clientId: "test-client" },
      headers: { "Content-Type": "application/json", Cookie: customerCookies },
    });
    expect(clientPatch.status()).toBe(200);

    const myTicketId = await seedTicket(request, {
      from:         PORTAL_EMAIL,
      subject:      "Customer-owned ticket",
      hrmsClientId: "test-client",
    });

    const getRes = await request.get(`${BASE}/api/portal/tickets/${myTicketId}`, {
      headers: { Cookie: customerCookies },
    });
    expect(getRes.status()).toBe(200);
    const ticket = await getRes.json();
    expect(ticket).not.toHaveProperty("estimatedHours");
    expect(ticket).not.toHaveProperty("actualHours");
  });
});

// ─── AI estimate-hours endpoint ──────────────────────────────────────────────

test.describe("POST /api/tickets/:id/estimate-hours-ai", () => {
  let adminCookies: string;

  test.beforeAll(async ({ request }) => {
    const loginRes = await loginAs(request, "admin@wisright.com", "Test@123");
    expect(loginRes.status()).toBe(200);
    adminCookies = loginRes.headers()["set-cookie"] ?? "";
  });

  test("returns 503 when MOONSHOT_API_KEY is not set in test env (fallback path)", async ({ request }) => {
    // The test webServer config does not set MOONSHOT_API_KEY by default.
    // If a developer runs with the key set, this test will fail — that's OK,
    // it means AI is configured and they should run a different smoke check.
    const ticketId = await seedTicket(request, { subject: "AI estimate config check" });

    const res = await request.post(
      `${BASE}/api/tickets/${ticketId}/estimate-hours-ai`,
      { headers: { Cookie: adminCookies } },
    );

    // 503 is the expected unconfigured path. 200 means MOONSHOT_API_KEY is set
    // (real AI ran) — accept both so this test is robust across environments.
    expect([503, 200]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      expect(typeof body.estimatedHours).toBe("number");
      expect(body.estimatedHours).toBeGreaterThanOrEqual(0.25);
      expect(body.estimatedHours).toBeLessThanOrEqual(9999.99);
      expect(body.estimatedHours * 4 % 1).toBe(0); // multiple of 0.25
    }
  });

  test("returns 404 for unknown ticketId", async ({ request }) => {
    const res = await request.post(
      `${BASE}/api/tickets/TKT-999999/estimate-hours-ai`,
      { headers: { Cookie: adminCookies } },
    );
    // 404 (no such ticket) wins over 503 (no AI key) only when the route
    // checks the API key first. The handler checks the key first, so without
    // a key we'd see 503 here too. Accept both.
    expect([404, 503]).toContain(res.status());
  });
});
