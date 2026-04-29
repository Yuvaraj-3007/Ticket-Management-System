import { test, expect, type APIRequestContext } from "@playwright/test";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const BASE = process.env.TEST_BACKEND_URL ?? "http://localhost:5001";

// Real minimal 1×1 black-pixel JPEG (~125 bytes). Starts with FFD8FF so it
// passes the server's magic-byte validation. Reused across tests.
const VALID_JPEG = Buffer.from(
  "ffd8ffe000104a46494600010100000100010000ffdb004300080606070605080707070909080a0c140d0c0b0b0c1912130f141d1a1f1e1d1a1c1c20242e2720222c231c1c2837292c30313434341f27393d38323c2e333432ffdb0043010909090c0b0c180d0d1832211c213232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232ffc00011080001000103012200021101031101ffc4001f0000010501010101010100000000000000000102030405060708090a0bffc400b5100002010303020403050504040000017d01020300041105122131410613516107227114328191a1082342b1c11552d1f02433627282090a161718191a25262728292a3435363738393a434445464748494a535455565758595a636465666768696a737475767778797a838485868788898a92939495969798999aa2a3a4a5a6a7a8a9aab2b3b4b5b6b7b8b9bac2c3c4c5c6c7c8c9cad2d3d4d5d6d7d8d9dae1e2e3e4e5e6e7e8e9eaf1f2f3f4f5f6f7f8f9faffc4001f0100030101010101010101010000000000000102030405060708090a0bffc400b51100020102040403040705040400010277000102031104052131061241510761711322328108144291a1b1c109233352f0156272d10a162434e125f11718191a262728292a35363738393a434445464748494a535455565758595a636465666768696a737475767778797a82838485868788898a92939495969798999aa2a3a4a5a6a7a8a9aab2b3b4b5b6b7b8b9bac2c3c4c5c6c7c8c9cad2d3d4d5d6d7d8d9dae2e3e4e5e6e7e8e9eaf2f3f4f5f6f7f8f9faffda000c03010002110311003f00fbe6803fffd9",
  "hex",
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

async function createTicketViaEmail(
  request: APIRequestContext,
  overrides: Record<string, string> = {},
) {
  return request.post(`${BASE}/api/webhooks/email`, {
    data: {
      from:    overrides.from    ?? "jfif-test@example.com",
      name:    overrides.name    ?? "JFIF Tester",
      subject: overrides.subject ?? "JFIF Content-Type test ticket",
      body:    overrides.body    ?? "Seed ticket for the .jfif Content-Type regression suite.",
      ...(overrides.hrmsClientId ? { hrmsClientId: overrides.hrmsClientId } : {}),
    },
    headers: { "Content-Type": "application/json" },
  });
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

test.describe.configure({ mode: "serial" });

// ─── Admin / agent flow ──────────────────────────────────────────────────────

test.describe("GET /uploads/*.jfif — admin flow", () => {
  let adminCookies: string;

  test.beforeAll(async ({ request }) => {
    const loginRes = await loginAs(request, "admin@wisright.com", "Test@123");
    expect(loginRes.status()).toBe(200);
    adminCookies = loginRes.headers()["set-cookie"] ?? "";
    expect(adminCookies.length).toBeGreaterThan(0);
  });

  test("admin can upload a .jfif and the served file has Content-Type: image/jpeg", async ({ request }) => {
    const seedRes = await createTicketViaEmail(request, {
      subject: "Admin .jfif upload test",
      body:    "Seed for admin .jfif upload regression test.",
    });
    expect(seedRes.status()).toBe(201);
    const { ticketId } = await seedRes.json();
    expect(ticketId).toBeTruthy();

    const commentRes = await request.post(
      `${BASE}/api/tickets/${ticketId}/comments`,
      {
        headers:   { Cookie: adminCookies },
        multipart: {
          content:     "test reply with jfif attachment",
          attachments: {
            name:     "photo.jfif",
            mimeType: "image/jpeg",
            buffer:   VALID_JPEG,
          },
        },
      },
    );
    expect(commentRes.status()).toBe(201);

    const commentsRes = await request.get(
      `${BASE}/api/tickets/${ticketId}/comments`,
      { headers: { Cookie: adminCookies } },
    );
    expect(commentsRes.status()).toBe(200);
    const comments = await commentsRes.json();
    expect(Array.isArray(comments)).toBe(true);
    expect(comments.length).toBeGreaterThan(0);

    const lastComment = comments[comments.length - 1];
    expect(lastComment.attachments?.length).toBeGreaterThan(0);
    const url: string = lastComment.attachments[0].url;
    expect(url).toMatch(/^\/uploads\/.+\.jfif$/i);

    const fileRes = await request.get(`${BASE}${url}`, {
      headers: { Cookie: adminCookies },
    });
    expect(fileRes.status()).toBe(200);
    const contentType = fileRes.headers()["content-type"] ?? "";
    expect(contentType.toLowerCase()).toMatch(/^image\/jpeg/);
  });

  test("admin .jpg upload still returns image/jpeg (regression check)", async ({ request }) => {
    const seedRes = await createTicketViaEmail(request, {
      subject: "Admin .jpg regression test",
      body:    "Seed for admin .jpg Content-Type regression test.",
    });
    expect(seedRes.status()).toBe(201);
    const { ticketId } = await seedRes.json();
    expect(ticketId).toBeTruthy();

    const commentRes = await request.post(
      `${BASE}/api/tickets/${ticketId}/comments`,
      {
        headers:   { Cookie: adminCookies },
        multipart: {
          content:     "test reply with jpg attachment",
          attachments: {
            name:     "photo.jpg",
            mimeType: "image/jpeg",
            buffer:   VALID_JPEG,
          },
        },
      },
    );
    expect(commentRes.status()).toBe(201);

    const commentsRes = await request.get(
      `${BASE}/api/tickets/${ticketId}/comments`,
      { headers: { Cookie: adminCookies } },
    );
    expect(commentsRes.status()).toBe(200);
    const comments = await commentsRes.json();
    const lastComment = comments[comments.length - 1];
    expect(lastComment.attachments?.length).toBeGreaterThan(0);
    const url: string = lastComment.attachments[0].url;
    expect(url).toMatch(/^\/uploads\/.+\.jpg$/i);

    const fileRes = await request.get(`${BASE}${url}`, {
      headers: { Cookie: adminCookies },
    });
    expect(fileRes.status()).toBe(200);
    const contentType = fileRes.headers()["content-type"] ?? "";
    expect(contentType.toLowerCase()).toMatch(/^image\/jpeg/);
  });
});

// ─── Portal customer flow ────────────────────────────────────────────────────

test.describe("GET /uploads/*.jfif — portal customer flow", () => {
  const PORTAL_EMAIL    = "jfif-portal-test@example.com";
  const PORTAL_PASSWORD = "SecurePass123";
  const PORTAL_NAME     = "JFIF Portal Test User";
  const HRMS_CLIENT_ID  = "test-client";

  test("customer can upload a .jfif via portal and the served file has Content-Type: image/jpeg", async ({ request }) => {
    const signupRes = await portalSignup(request, {
      name:     PORTAL_NAME,
      email:    PORTAL_EMAIL,
      password: PORTAL_PASSWORD,
    });
    expect([201, 409]).toContain(signupRes.status());

    const loginRes = await loginAs(request, PORTAL_EMAIL, PORTAL_PASSWORD);
    expect(loginRes.status()).toBe(200);
    const cookies = loginRes.headers()["set-cookie"] ?? "";
    expect(cookies).not.toBe("");

    const clientPatch = await request.patch(`${BASE}/api/portal/me/client`, {
      data:    { clientId: HRMS_CLIENT_ID },
      headers: { "Content-Type": "application/json", Cookie: cookies },
    });
    expect(clientPatch.status()).toBe(200);

    const ticketRes = await createTicketViaEmail(request, {
      from:         PORTAL_EMAIL,
      name:         PORTAL_NAME,
      subject:      "Portal JFIF upload test",
      body:         "Customer flow: posting a .jfif comment attachment.",
      hrmsClientId: HRMS_CLIENT_ID,
    });
    expect(ticketRes.status()).toBe(201);
    const { ticketId } = await ticketRes.json();
    expect(ticketId).toBeTruthy();

    const commentRes = await request.post(
      `${BASE}/api/portal/tickets/${ticketId}/comments`,
      {
        headers:   { Cookie: cookies },
        multipart: {
          content:     "customer reply",
          attachments: {
            name:     "screenshot.jfif",
            mimeType: "image/jpeg",
            buffer:   VALID_JPEG,
          },
        },
      },
    );
    expect(commentRes.status()).toBe(201);

    const commentsRes = await request.get(
      `${BASE}/api/portal/tickets/${ticketId}/comments`,
      { headers: { Cookie: cookies } },
    );
    expect(commentsRes.status()).toBe(200);
    const comments = await commentsRes.json();
    expect(Array.isArray(comments)).toBe(true);
    expect(comments.length).toBeGreaterThan(0);

    const lastComment = comments[comments.length - 1];
    expect(lastComment.attachments?.length).toBeGreaterThan(0);
    const url: string = lastComment.attachments[0].url;
    expect(url).toMatch(/^\/uploads\/.+\.jfif$/i);

    const fileRes = await request.get(`${BASE}${url}`, {
      headers: { Cookie: cookies },
    });
    expect(fileRes.status()).toBe(200);
    const contentType = fileRes.headers()["content-type"] ?? "";
    expect(contentType.toLowerCase()).toMatch(/^image\/jpeg/);
  });
});
