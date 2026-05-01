import { test, expect, type APIRequestContext } from "@playwright/test";

// ---------------------------------------------------------------------------
// Phase 2: type-filter tabs (Bugs & Support / Implementation Requests / All)
// API-level coverage of the array-form `type` filter introduced in
// ticketQuerySchema. The list endpoints are shared by the admin UI and portal,
// so we test both surfaces.
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

/** Seed a ticket with a specific type via the email webhook then promote it. */
async function seedTicketWithType(
  request: APIRequestContext,
  cookies: string,
  opts: { from?: string; subject: string; type: string },
): Promise<string> {
  const seedRes = await request.post(`${BASE}/api/webhooks/email`, {
    data: {
      from:    opts.from ?? "tabs-test@example.com",
      name:    "Tabs Tester",
      subject: opts.subject,
      body:    "Body for tab filter test ticket.",
    },
    headers: { "Content-Type": "application/json" },
  });
  expect(seedRes.status()).toBe(201);
  const { ticketId } = await seedRes.json();

  // Promote to the requested type via the existing PATCH /:id/type endpoint.
  const patchRes = await request.patch(`${BASE}/api/tickets/${ticketId}/type`, {
    headers: { "Content-Type": "application/json", Cookie: cookies },
    data:    { type: opts.type },
  });
  expect(patchRes.status()).toBe(200);
  return ticketId;
}

test.describe.configure({ mode: "serial" });

test.describe("GET /api/tickets — type[] filter (admin tabs)", () => {
  let adminCookies: string;
  let bugId: string;
  let implId: string;

  test.beforeAll(async ({ request }) => {
    const loginRes = await loginAs(request, "admin@wisright.com", "Test@123");
    expect(loginRes.status()).toBe(200);
    adminCookies = loginRes.headers()["set-cookie"] ?? "";

    bugId  = await seedTicketWithType(request, adminCookies, { subject: "Tab seed: BUG",            type: "BUG" });
    implId = await seedTicketWithType(request, adminCookies, { subject: "Tab seed: IMPLEMENTATION", type: "IMPLEMENTATION" });
  });

  test("Bugs & Support tab — only non-IMPLEMENTATION tickets", async ({ request }) => {
    // tab = "bug" → the client sends type=BUG&type=REQUIREMENT&type=TASK&type=SUPPORT&type=EXPLANATION
    const params = new URLSearchParams();
    for (const t of ["BUG", "REQUIREMENT", "TASK", "SUPPORT", "EXPLANATION"]) params.append("type", t);
    params.set("page", "1");
    params.set("pageSize", "100");

    const res = await request.get(`${BASE}/api/tickets?${params.toString()}`, {
      headers: { Cookie: adminCookies },
    });
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(Array.isArray(json.data)).toBe(true);

    const ticketIds = json.data.map((t: { ticketId: string }) => t.ticketId);
    expect(ticketIds).toContain(bugId);
    expect(ticketIds).not.toContain(implId);
    for (const t of json.data) {
      expect(["BUG", "REQUIREMENT", "TASK", "SUPPORT", "EXPLANATION"]).toContain(t.type);
    }
  });

  test("Implementation Requests tab — only IMPLEMENTATION tickets", async ({ request }) => {
    const params = new URLSearchParams();
    params.append("type", "IMPLEMENTATION");
    params.set("page", "1");
    params.set("pageSize", "100");

    const res = await request.get(`${BASE}/api/tickets?${params.toString()}`, {
      headers: { Cookie: adminCookies },
    });
    expect(res.status()).toBe(200);
    const json = await res.json();

    const ticketIds = json.data.map((t: { ticketId: string }) => t.ticketId);
    expect(ticketIds).toContain(implId);
    expect(ticketIds).not.toContain(bugId);
    for (const t of json.data) {
      expect(t.type).toBe("IMPLEMENTATION");
    }
  });

  test("All tab — both ticket types appear", async ({ request }) => {
    const res = await request.get(
      `${BASE}/api/tickets?page=1&pageSize=100`,
      { headers: { Cookie: adminCookies } },
    );
    expect(res.status()).toBe(200);
    const json = await res.json();

    const ticketIds = json.data.map((t: { ticketId: string }) => t.ticketId);
    expect(ticketIds).toContain(bugId);
    expect(ticketIds).toContain(implId);
  });

  test("Single-value type filter (legacy clients) still works", async ({ request }) => {
    const res = await request.get(
      `${BASE}/api/tickets?type=BUG&page=1&pageSize=100`,
      { headers: { Cookie: adminCookies } },
    );
    expect(res.status()).toBe(200);
    const json = await res.json();
    for (const t of json.data) expect(t.type).toBe("BUG");
  });
});

test.describe("GET /api/portal/tickets — type[] filter (portal tabs)", () => {
  const PORTAL_EMAIL    = "tabs-portal@example.com";
  const PORTAL_PASSWORD = "SecurePass123";
  const HRMS_CLIENT_ID  = "test-client";

  let adminCookies:    string;
  let customerCookies: string;
  let bugId:           string;
  let implId:          string;

  test.beforeAll(async ({ request }) => {
    // Admin for promoting ticket types
    const adminLogin = await loginAs(request, "admin@wisright.com", "Test@123");
    expect(adminLogin.status()).toBe(200);
    adminCookies = adminLogin.headers()["set-cookie"] ?? "";

    // Customer signup + login + bind to test client
    const signupRes = await portalSignup(request, {
      name: "Tabs Portal", email: PORTAL_EMAIL, password: PORTAL_PASSWORD,
    });
    expect([201, 409]).toContain(signupRes.status());

    const loginRes = await loginAs(request, PORTAL_EMAIL, PORTAL_PASSWORD);
    expect(loginRes.status()).toBe(200);
    customerCookies = loginRes.headers()["set-cookie"] ?? "";

    const bindRes = await request.patch(`${BASE}/api/portal/me/client`, {
      data:    { clientId: HRMS_CLIENT_ID },
      headers: { "Content-Type": "application/json", Cookie: customerCookies },
    });
    expect(bindRes.status()).toBe(200);

    // Seed two tickets owned by the customer (sender=customer email)
    const seedBug = await request.post(`${BASE}/api/webhooks/email`, {
      data: {
        from:         PORTAL_EMAIL,
        name:         "Tabs Portal",
        subject:      "Portal tab seed: BUG",
        body:         "Body.",
        hrmsClientId: HRMS_CLIENT_ID,
      },
      headers: { "Content-Type": "application/json" },
    });
    expect(seedBug.status()).toBe(201);
    bugId = (await seedBug.json()).ticketId;
    const promoteBug = await request.patch(`${BASE}/api/tickets/${bugId}/type`, {
      headers: { "Content-Type": "application/json", Cookie: adminCookies },
      data:    { type: "BUG" },
    });
    expect(promoteBug.status()).toBe(200);

    const seedImpl = await request.post(`${BASE}/api/webhooks/email`, {
      data: {
        from:         PORTAL_EMAIL,
        name:         "Tabs Portal",
        subject:      "Portal tab seed: IMPLEMENTATION",
        body:         "Body.",
        hrmsClientId: HRMS_CLIENT_ID,
      },
      headers: { "Content-Type": "application/json" },
    });
    expect(seedImpl.status()).toBe(201);
    implId = (await seedImpl.json()).ticketId;
    const promoteImpl = await request.patch(`${BASE}/api/tickets/${implId}/type`, {
      headers: { "Content-Type": "application/json", Cookie: adminCookies },
      data:    { type: "IMPLEMENTATION" },
    });
    expect(promoteImpl.status()).toBe(200);
  });

  test("Portal Bugs & Support tab — IMPLEMENTATION ticket excluded", async ({ request }) => {
    const params = new URLSearchParams();
    for (const t of ["BUG", "REQUIREMENT", "TASK", "SUPPORT", "EXPLANATION"]) params.append("type", t);
    params.set("page", "1");
    params.set("pageSize", "100");

    const res = await request.get(`${BASE}/api/portal/tickets?${params.toString()}`, {
      headers: { Cookie: customerCookies },
    });
    expect(res.status()).toBe(200);
    const json = await res.json();
    const list = Array.isArray(json) ? json : json.data;
    expect(Array.isArray(list)).toBe(true);

    const ticketIds = list.map((t: { ticketId: string }) => t.ticketId);
    expect(ticketIds).toContain(bugId);
    expect(ticketIds).not.toContain(implId);
  });

  test("Portal Implementation Requests tab — only IMPLEMENTATION ticket", async ({ request }) => {
    const params = new URLSearchParams();
    params.append("type", "IMPLEMENTATION");
    params.set("page", "1");
    params.set("pageSize", "100");

    const res = await request.get(`${BASE}/api/portal/tickets?${params.toString()}`, {
      headers: { Cookie: customerCookies },
    });
    expect(res.status()).toBe(200);
    const json = await res.json();
    const list = Array.isArray(json) ? json : json.data;

    const ticketIds = list.map((t: { ticketId: string }) => t.ticketId);
    expect(ticketIds).toContain(implId);
    expect(ticketIds).not.toContain(bugId);
  });
});
