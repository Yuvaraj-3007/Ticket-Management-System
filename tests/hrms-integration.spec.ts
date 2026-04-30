import { test, expect, type APIRequestContext } from "@playwright/test";

// ---------------------------------------------------------------------------
// Verify the live-fetch HRMS architecture. New projects/employees added to
// HRMS-POC appear in TMS automatically because TMS calls HRMS at request-time
// for clients (`/customers/list`) and projects (`/projects/by-customer/:id`).
// In the test env HRMS is not configured, so we assert the documented
// fallback / 404 behaviour rather than live HRMS data.
// ---------------------------------------------------------------------------

const BASE = process.env.TEST_BACKEND_URL ?? "http://localhost:5001";

async function loginAs(request: APIRequestContext, email: string, password: string) {
  return request.post(`${BASE}/api/auth/sign-in/email`, {
    data:    { email, password },
    headers: { "Content-Type": "application/json" },
  });
}

test.describe.configure({ mode: "serial" });

test.describe("HRMS integration — clients / users / projects", () => {
  let adminCookies: string;

  test.beforeAll(async ({ request }) => {
    const loginRes = await loginAs(request, "admin@wisright.com", "Test@123");
    expect(loginRes.status()).toBe(200);
    adminCookies = loginRes.headers()["set-cookie"] ?? "";
    expect(adminCookies.length).toBeGreaterThan(0);
  });

  test("GET /api/tickets/clients returns 200 with an array (HRMS or DB fallback)", async ({ request }) => {
    const res = await request.get(`${BASE}/api/tickets/clients`, {
      headers: { Cookie: adminCookies },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    // Each entry is { id, name } whether sourced from HRMS or distinct ticket.hrmsClientId
    for (const c of body) {
      expect(typeof c.id).toBe("string");
      expect(typeof c.name).toBe("string");
    }
  });

  test("GET /api/tickets/assignable-users (no projectId) returns merged TMS+HRMS list", async ({ request }) => {
    const res = await request.get(`${BASE}/api/tickets/assignable-users`, {
      headers: { Cookie: adminCookies },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    // Endpoint returns { id, name } only — emails are intentionally omitted
    // (server/src/routes/tickets.ts:194). At minimum the seeded admin must
    // be in the list, identifiable by id (admin user from seed).
    expect(body.length).toBeGreaterThan(0);
    for (const u of body) {
      expect(typeof u.id).toBe("string");
      expect(typeof u.name).toBe("string");
      expect(u).not.toHaveProperty("email");
    }
  });

  test("GET /api/portal/:slug/projects returns 404 for an unknown slug", async ({ request }) => {
    const res = await request.get(`${BASE}/api/portal/unknown-slug-zzz/projects`);
    expect(res.status()).toBe(404);
  });

  test("POST /api/users/sync-hrms returns a SyncResult (skipped when HRMS unconfigured)", async ({ request }) => {
    const res = await request.post(`${BASE}/api/users/sync-hrms`, {
      headers: { Cookie: adminCookies },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    // Shape: { skipped: boolean, deactivated: string[], reactivated: string[] }
    expect(typeof body.skipped).toBe("boolean");
    expect(Array.isArray(body.deactivated)).toBe(true);
    expect(Array.isArray(body.reactivated)).toBe(true);
    // In the test env HRMS_API_URL is unset, so sync should skip gracefully.
    // If a developer runs with HRMS configured locally, skipped may be false.
    // Either path is valid.
  });

  test("non-admin agent cannot call POST /api/users/sync-hrms", async ({ request }) => {
    // The route requires admin; a portal customer must be rejected.
    // Fresh signup + login as customer.
    const email = "hrms-blocked-customer@example.com";
    const password = "SecurePass123";
    const signupRes = await request.post(`${BASE}/api/portal/auth/signup`, {
      data:    { name: "Blocked", email, password },
      headers: { "Content-Type": "application/json" },
    });
    expect([201, 409]).toContain(signupRes.status());

    const loginRes = await loginAs(request, email, password);
    expect(loginRes.status()).toBe(200);
    const cookies = loginRes.headers()["set-cookie"] ?? "";

    const res = await request.post(`${BASE}/api/users/sync-hrms`, {
      headers: { Cookie: cookies },
    });
    expect([401, 403]).toContain(res.status());
  });
});
