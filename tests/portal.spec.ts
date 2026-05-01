import { test, expect, type APIRequestContext } from "@playwright/test";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const BASE = process.env.TEST_BACKEND_URL ?? "http://localhost:5001";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** POST /api/portal/auth/signup */
async function signup(request: APIRequestContext, body: Record<string, unknown>) {
  return request.post(`${BASE}/api/portal/auth/signup`, {
    data:    body,
    headers: { "Content-Type": "application/json" },
  });
}

/** POST /api/auth/sign-in/email  (Better Auth session login) */
async function loginAs(request: APIRequestContext, email: string, password: string) {
  return request.post(`${BASE}/api/auth/sign-in/email`, {
    data:    { email, password },
    headers: { "Content-Type": "application/json" },
  });
}

/** GET /api/portal/captcha — fetches a server-signed captcha challenge.
 *  In test mode the server also returns `code` (plaintext) so E2E tests can
 *  submit a correct answer without breaking the security model in production. */
async function getCaptcha(request: APIRequestContext) {
  const res = await request.get(`${BASE}/api/portal/captcha`);
  expect(res.status()).toBe(200);
  return res.json() as Promise<{ token: string; code?: string }>;
}

/** POST /api/webhooks/email — creates a ticket as a seeded email sender */
async function createTicketViaEmail(
  request: APIRequestContext,
  overrides: Record<string, string> = {},
) {
  return request.post(`${BASE}/api/webhooks/email`, {
    data: {
      from:    overrides.from    ?? "customer@example.com",
      name:    overrides.name    ?? "Portal Customer",
      subject: overrides.subject ?? "Test Portal Ticket",
      body:    overrides.body    ?? "This is a test ticket from the portal.",
      ...(overrides.hrmsClientId ? { hrmsClientId: overrides.hrmsClientId } : {}),
    },
    headers: { "Content-Type": "application/json" },
  });
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

test.describe.configure({ mode: "serial" });

// ─── Shared state across tests in this file ──────────────────────────────────
let customerCookies: string;
const CUSTOMER_EMAIL    = "portal-test@example.com";
const CUSTOMER_PASSWORD = "SecurePass123";
const CUSTOMER_NAME     = "Portal Test User";

// ─── POST /api/portal/auth/signup ────────────────────────────────────────────

test.describe("POST /api/portal/auth/signup", () => {
  test("creates a CUSTOMER account and returns 201", async ({ request }) => {
    const res = await signup(request, {
      name:     CUSTOMER_NAME,
      email:    CUSTOMER_EMAIL,
      password: CUSTOMER_PASSWORD,
    });
    expect(res.status()).toBe(201);
    const json = await res.json();
    expect(json.success).toBe(true);
  });

  test("returns 409 if email already exists", async ({ request }) => {
    const res = await signup(request, {
      name:     CUSTOMER_NAME,
      email:    CUSTOMER_EMAIL,
      password: CUSTOMER_PASSWORD,
    });
    expect(res.status()).toBe(409);
    const json = await res.json();
    expect(json.error).toMatch(/already exists/i);
  });

  test("returns 400 if name is missing", async ({ request }) => {
    const res = await signup(request, {
      email:    "other@example.com",
      password: CUSTOMER_PASSWORD,
    });
    expect(res.status()).toBe(400);
    const json = await res.json();
    expect(json.fieldErrors).toBeDefined();
  });

  test("returns 400 if email is invalid", async ({ request }) => {
    const res = await signup(request, {
      name:     "Test",
      email:    "not-an-email",
      password: CUSTOMER_PASSWORD,
    });
    expect(res.status()).toBe(400);
    const json = await res.json();
    expect(json.fieldErrors).toBeDefined();
  });

  test("returns 400 if password is too short", async ({ request }) => {
    const res = await signup(request, {
      name:     "Test",
      email:    "short@example.com",
      password: "abc",
    });
    expect(res.status()).toBe(400);
    const json = await res.json();
    expect(json.fieldErrors).toBeDefined();
  });

  test("customer can sign in after signup", async ({ request }) => {
    const res = await loginAs(request, CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.user.email).toBe(CUSTOMER_EMAIL);
    expect(json.user.role).toBe("CUSTOMER");
    // Save cookies for subsequent authenticated tests
    const setCookieHeader = res.headers()["set-cookie"] ?? "";
    customerCookies = setCookieHeader;
  });
});

// ─── Customer ticket routes (requireCustomer) ─────────────────────────────────

test.describe("Customer portal — ticket routes", () => {
  let ticketId: string; // TKT-XXXX from the webhook

  test.beforeAll(async ({ request }) => {
    // Ensure we have a session cookie
    const loginRes = await loginAs(request, CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    expect(loginRes.status()).toBe(200);
    customerCookies = loginRes.headers()["set-cookie"] ?? "";

    // Set portal client association so the customer can access their tickets
    const clientPatch = await request.patch(`${BASE}/api/portal/me/client`, {
      data:    { clientId: "test-client" },
      headers: { "Content-Type": "application/json", Cookie: customerCookies },
    });
    expect(clientPatch.status()).toBe(200);

    // Create a ticket whose senderEmail matches CUSTOMER_EMAIL
    const tRes = await createTicketViaEmail(request, {
      from:         CUSTOMER_EMAIL,
      name:         CUSTOMER_NAME,
      subject:      "My portal ticket",
      body:         "I need help.",
      hrmsClientId: "test-client",
    });
    expect(tRes.status()).toBe(201);
    ticketId = (await tRes.json()).ticketId;
  });

  // ── GET /api/portal/tickets ────────────────────────────────────────────────

  test("GET /tickets — returns 401 without auth", async ({ request }) => {
    const res = await request.get(`${BASE}/api/portal/tickets`);
    expect(res.status()).toBe(401);
  });

  test("GET /tickets — returns customer's own tickets", async ({ request }) => {
    const res = await request.get(`${BASE}/api/portal/tickets`, {
      headers: { Cookie: customerCookies },
    });
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(Array.isArray(json.data)).toBe(true);
    expect(typeof json.total).toBe("number");
    expect(typeof json.page).toBe("number");
    expect(typeof json.pageSize).toBe("number");
    expect(typeof json.totalPages).toBe("number");
    // Should contain the ticket we created
    const found = json.data.find((t: any) => t.ticketId === ticketId);
    expect(found).toBeDefined();
  });

  test("GET /tickets — supports status filter", async ({ request }) => {
    const res = await request.get(`${BASE}/api/portal/tickets?status=UN_ASSIGNED`, {
      headers: { Cookie: customerCookies },
    });
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(Array.isArray(json.data)).toBe(true);
    // All returned tickets should have status UN_ASSIGNED (default for webhook-created tickets)
    for (const t of json.data) {
      expect(t.status).toBe("UN_ASSIGNED");
    }
  });

  test("GET /tickets — supports pagination", async ({ request }) => {
    const res = await request.get(`${BASE}/api/portal/tickets?page=1&pageSize=1`, {
      headers: { Cookie: customerCookies },
    });
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.data.length).toBeLessThanOrEqual(1);
    expect(json.pageSize).toBe(1);
  });

  // ── GET /api/portal/tickets/:id ────────────────────────────────────────────

  test("GET /tickets/:id — returns 401 without auth", async ({ request }) => {
    const res = await request.get(`${BASE}/api/portal/tickets/${ticketId}`);
    expect(res.status()).toBe(401);
  });

  test("GET /tickets/:id — returns the ticket for its owner", async ({ request }) => {
    const res = await request.get(`${BASE}/api/portal/tickets/${ticketId}`, {
      headers: { Cookie: customerCookies },
    });
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.ticketId).toBe(ticketId);
    expect(json.senderEmail).toBe(CUSTOMER_EMAIL);
    expect(json._count).toBeDefined();
    expect(typeof json._count.comments).toBe("number");
  });

  test("GET /tickets/:id — returns 404 for unknown ticket", async ({ request }) => {
    const res = await request.get(`${BASE}/api/portal/tickets/TKT-9999`, {
      headers: { Cookie: customerCookies },
    });
    expect(res.status()).toBe(404);
  });

  test("GET /tickets/:id — returns 403 for a ticket owned by another sender", async ({ request }) => {
    // Create a ticket with a different email
    const otherRes = await createTicketViaEmail(request, {
      from:    "other@example.com",
      subject: "Other user ticket",
      body:    "Not mine.",
    });
    const otherId = (await otherRes.json()).ticketId;

    const res = await request.get(`${BASE}/api/portal/tickets/${otherId}`, {
      headers: { Cookie: customerCookies },
    });
    expect(res.status()).toBe(403);
  });

  // ── GET /api/portal/tickets/:id/comments ──────────────────────────────────

  test("GET /tickets/:id/comments — returns 401 without auth", async ({ request }) => {
    const res = await request.get(`${BASE}/api/portal/tickets/${ticketId}/comments`);
    expect(res.status()).toBe(401);
  });

  test("GET /tickets/:id/comments — returns empty array for new ticket", async ({ request }) => {
    const res = await request.get(`${BASE}/api/portal/tickets/${ticketId}/comments`, {
      headers: { Cookie: customerCookies },
    });
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  // ── POST /api/portal/tickets/:id/comments ─────────────────────────────────

  test("POST /tickets/:id/comments — returns 401 without auth", async ({ request }) => {
    const res = await request.post(`${BASE}/api/portal/tickets/${ticketId}/comments`, {
      data:    { content: "Hello?" },
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status()).toBe(401);
  });

  test("POST /tickets/:id/comments — creates a CUSTOMER comment", async ({ request }) => {
    const res = await request.post(`${BASE}/api/portal/tickets/${ticketId}/comments`, {
      data:    { content: "Any update on this?" },
      headers: {
        "Content-Type": "application/json",
        Cookie:         customerCookies,
      },
    });
    expect(res.status()).toBe(201);
    const json = await res.json();
    expect(json.content).toBe("Any update on this?");
    expect(json.senderType).toBe("CUSTOMER");
    expect(json.author.name).toBe(CUSTOMER_NAME);
  });

  test("POST /tickets/:id/comments — returns 400 for empty content", async ({ request }) => {
    const res = await request.post(`${BASE}/api/portal/tickets/${ticketId}/comments`, {
      data:    { content: "" },
      headers: {
        "Content-Type": "application/json",
        Cookie:         customerCookies,
      },
    });
    expect(res.status()).toBe(400);
  });

  test("GET /tickets/:id/comments — shows the comment just posted", async ({ request }) => {
    const res = await request.get(`${BASE}/api/portal/tickets/${ticketId}/comments`, {
      headers: { Cookie: customerCookies },
    });
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.length).toBeGreaterThan(0);
    expect(json[0].senderType).toBe("CUSTOMER");
  });

  // ── PATCH /api/portal/tickets/:id/rating ──────────────────────────────────

  test("PATCH /tickets/:id/rating — returns 401 without auth", async ({ request }) => {
    const res = await request.patch(`${BASE}/api/portal/tickets/${ticketId}/rating`, {
      data:    { rating: 5 },
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status()).toBe(401);
  });

  test("PATCH /tickets/:id/rating — returns 400 if ticket is not CLOSED", async ({ request }) => {
    // In test env, tickets are created with status OPEN, not CLOSED
    const res = await request.patch(`${BASE}/api/portal/tickets/${ticketId}/rating`, {
      data:    { rating: 4 },
      headers: {
        "Content-Type": "application/json",
        Cookie:         customerCookies,
      },
    });
    expect(res.status()).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/closed/i);
  });

  test("PATCH /tickets/:id/rating — returns 400 for rating out of range", async ({ request }) => {
    const res = await request.patch(`${BASE}/api/portal/tickets/${ticketId}/rating`, {
      data:    { rating: 6 },
      headers: {
        "Content-Type": "application/json",
        Cookie:         customerCookies,
      },
    });
    expect(res.status()).toBe(400);
  });
});

// ─── HRMS slug routes (public) ────────────────────────────────────────────────

test.describe("GET /api/portal/:slug — public HRMS lookup", () => {
  test("returns 404 when HRMS is not configured or slug not found", async ({ request }) => {
    // In test environment HRMS_API_PASSWORD is not set, so getHrmsToken returns null
    // and getClientBySlug returns null → 404
    const res = await request.get(`${BASE}/api/portal/unknown-slug-xyz`);
    expect(res.status()).toBe(404);
  });
});

// ─── GET /api/portal/captcha — server-side CAPTCHA endpoint ──────────────────

test.describe("GET /api/portal/captcha — server-side CAPTCHA", () => {
  test("returns 200 with a 3-part token — no plaintext code in production", async ({ request }) => {
    const res = await request.get(`${BASE}/api/portal/captcha`);
    expect(res.status()).toBe(200);
    const json = await res.json() as { token: string; code?: string };
    expect(typeof json.token).toBe("string");
    // Token must be 3-part: ts.encryptedCode.hmac (NOT the old 2-part ts.sig format)
    const parts = json.token.split(".");
    expect(parts.length).toBe(3);
    expect(parts[0]).toMatch(/^\d+$/);         // timestamp
    expect(parts[1]).toMatch(/^[0-9a-f]+$/);   // encrypted code (hex)
    expect(parts[2]).toMatch(/^[0-9a-f]+$/);   // HMAC (hex)
    // Test-mode backdoor: code must be present and 5 characters
    expect(typeof json.code).toBe("string");
    expect((json.code as string).length).toBe(5);
  });

  test("each call produces a unique token", async ({ request }) => {
    const [a, b] = await Promise.all([getCaptcha(request), getCaptcha(request)]);
    expect(a.token).not.toBe(b.token);
  });
});

// ─── GET /api/portal/captcha-image — server-rendered SVG ─────────────────────

test.describe("GET /api/portal/captcha-image — server-rendered CAPTCHA image", () => {
  test("returns SVG for a valid token", async ({ request }) => {
    const { token } = await getCaptcha(request);
    const res = await request.get(
      `${BASE}/api/portal/captcha-image?token=${encodeURIComponent(token)}`,
    );
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("image/svg+xml");
    expect(res.headers()["cache-control"]).toContain("no-store");
    const body = await res.text();
    expect(body).toContain("<svg");
  });

  test("returns 400 for a malformed token", async ({ request }) => {
    const res = await request.get(`${BASE}/api/portal/captcha-image?token=invalid.token`);
    expect(res.status()).toBe(400);
  });

  test("returns 400 when token is missing", async ({ request }) => {
    const res = await request.get(`${BASE}/api/portal/captcha-image`);
    expect(res.status()).toBe(400);
  });
});

// ─── CAPTCHA single-use enforcement ──────────────────────────────────────────

test.describe("CAPTCHA — single-use token enforcement", () => {
  test("second submission with the same token is rejected as replayed", async ({ request }) => {
    const { token, code } = await getCaptcha(request);
    expect(code).toBeDefined();

    const payload = {
      name:          "Alice",
      email:         "alice@example.com",
      subject:       "Help needed",
      body:          "I need assistance.",
      captchaToken:  token,
      captchaAnswer: code!,
    };

    // First use — captcha valid, HRMS slug unknown → 404 (captcha passed)
    const first = await request.post(`${BASE}/api/portal/unknown-slug-xyz/tickets`, {
      data:    payload,
      headers: { "Content-Type": "application/json" },
    });
    expect(first.status()).toBe(404);

    // Second use — same token+answer → captcha rejected (already used)
    const second = await request.post(`${BASE}/api/portal/unknown-slug-xyz/tickets`, {
      data:    payload,
      headers: { "Content-Type": "application/json" },
    });
    expect(second.status()).toBe(400);
    const json = await second.json();
    expect(json.error).toMatch(/captcha/i);
  });
});

test.describe("POST /api/portal/:slug/tickets — public portal submission", () => {
  test("returns 400 for missing required fields (schema fails before captcha)", async ({ request }) => {
    const res = await request.post(`${BASE}/api/portal/some-slug/tickets`, {
      data:    { subject: "No name or email" },
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status()).toBe(400);
    const json = await res.json();
    expect(json.fieldErrors).toBeDefined();
  });

  test("returns 400 for invalid email (schema fails before captcha)", async ({ request }) => {
    const res = await request.post(`${BASE}/api/portal/some-slug/tickets`, {
      data: {
        name:    "Bob",
        email:   "not-an-email",
        subject: "Test",
        body:    "Hello.",
      },
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status()).toBe(400);
  });

  test("returns 400 when captcha token is missing but schema is valid", async ({ request }) => {
    // Schema passes but no captcha fields → captcha verification fails
    const res = await request.post(`${BASE}/api/portal/some-slug/tickets`, {
      data: {
        name:    "Alice",
        email:   "alice@example.com",
        subject: "Help needed",
        body:    "I need assistance.",
      },
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status()).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/captcha/i);
  });

  test("returns 400 when captcha answer is wrong", async ({ request }) => {
    const { token } = await getCaptcha(request);
    const res = await request.post(`${BASE}/api/portal/some-slug/tickets`, {
      data: {
        name:         "Alice",
        email:        "alice@example.com",
        subject:      "Help needed",
        body:         "I need assistance.",
        captchaToken:  token,
        captchaAnswer: "WRONG",
      },
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status()).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/captcha/i);
  });

  test("returns 404 (not 400) when captcha is valid but HRMS client is not found", async ({ request }) => {
    const { code, token } = await getCaptcha(request);
    const res = await request.post(`${BASE}/api/portal/unknown-slug-xyz/tickets`, {
      data: {
        name:          "Alice",
        email:         "alice@example.com",
        subject:       "Help needed",
        body:          "I need assistance.",
        captchaToken:  token,
        captchaAnswer: code!, // code is present in test mode via server backdoor
      },
      headers: { "Content-Type": "application/json" },
    });
    // Captcha passes; HRMS lookup fails → 404
    expect(res.status()).toBe(404);
  });
});

// ─── POST /api/portal/:slug/tickets — image upload validation ────────────────

test.describe("POST /api/portal/:slug/tickets — image upload validation", () => {
  // These tests send multipart/form-data to the public submit endpoint.
  // HRMS is not configured in test env, so slug lookups return 404 after
  // multer runs. We use that to confirm multer ran and either accepted or
  // rejected the payload before the HRMS check.

  test("returns 400 when a non-image file type is attached", async ({ request }) => {
    const res = await request.post(`${BASE}/api/portal/some-slug/tickets`, {
      multipart: {
        name:    "Alice",
        email:   "alice@example.com",
        subject: "Upload test",
        body:    "Attaching a text file.",
        attachments: {
          name:     "document.txt",
          mimeType: "text/plain",
          buffer:   Buffer.from("hello world"),
        },
      },
    });
    // Multer rejects non-image types with 400 before the HRMS lookup
    expect(res.status()).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/image/i);
  });

  test("returns 400 when an image exceeds 1MB", async ({ request }) => {
    // Create a buffer just over 1MB
    const bigBuffer = Buffer.alloc(1 * 1024 * 1024 + 1, 0);
    const res = await request.post(`${BASE}/api/portal/some-slug/tickets`, {
      multipart: {
        name:    "Alice",
        email:   "alice@example.com",
        subject: "Large file test",
        body:    "Attaching a large image.",
        attachments: {
          name:     "large.jpg",
          mimeType: "image/jpeg",
          buffer:   bigBuffer,
        },
      },
    });
    expect(res.status()).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/1MB|file size/i);
  });

  test("returns 400 (captcha invalid) when a valid image is attached but no captcha token", async ({ request }) => {
    // A valid 1x1 PNG (smallest valid PNG ~68 bytes)
    const validPng = Buffer.from(
      "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c6260000000020001e221bc330000000049454e44ae426082",
      "hex",
    );
    const res = await request.post(`${BASE}/api/portal/unknown-slug-xyz/tickets`, {
      multipart: {
        name:    "Alice",
        email:   "alice@example.com",
        subject: "Valid image test",
        body:    "Attaching a valid PNG.",
        attachments: {
          name:     "photo.png",
          mimeType: "image/png",
          buffer:   validPng,
        },
      },
    });
    // Multer accepted the file; schema passes; captcha missing → 400
    expect(res.status()).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/captcha/i);
  });

  test("returns 400 when a polyglot file passes MIME/extension check but has wrong magic bytes", async ({ request }) => {
    // Craft a PDF-header payload disguised as image/jpeg with a .jpg extension.
    // The multer fileFilter allows it (correct MIME + extension), but validateMagicBytes
    // should catch it because the first bytes are "%PDF" (0x25 0x50 0x44 0x46), not
    // the JPEG SOI marker 0xFF 0xD8 0xFF.
    const pdfHeader = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E]); // "%PDF-1."
    const htmlPayload = Buffer.from("<script>alert(1)</script>");
    const polyglotBuffer = Buffer.concat([pdfHeader, htmlPayload]);

    const res = await request.post(`${BASE}/api/portal/some-slug/tickets`, {
      multipart: {
        name:    "Mallory",
        email:   "mallory@example.com",
        subject: "Polyglot upload test",
        body:    "Sneaking a PDF+HTML file as a JPEG.",
        attachments: {
          name:     "evil.jpg",        // correct extension for image/jpeg
          mimeType: "image/jpeg",      // correct MIME type
          buffer:   polyglotBuffer,    // but bytes start with PDF signature, not JPEG
        },
      },
    });
    // Magic byte check rejects it before any HRMS / DB work
    expect(res.status()).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/file-type validation/i);
  });

  test("returns 400 when a plain-text file is disguised as a PNG with correct MIME and extension", async ({ request }) => {
    // Plain text has no image magic bytes — validateMagicBytes must reject it
    // even though multer accepts the MIME type / extension combination.
    const fakeBuffer = Buffer.from("This is not an image at all.");

    const res = await request.post(`${BASE}/api/portal/some-slug/tickets`, {
      multipart: {
        name:    "Mallory",
        email:   "mallory@example.com",
        subject: "Fake PNG test",
        body:    "Disguising text as PNG.",
        attachments: {
          name:     "photo.png",
          mimeType: "image/png",
          buffer:   fakeBuffer,
        },
      },
    });
    expect(res.status()).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/file-type validation/i);
  });

  test("returns 404 (not 400) when valid image + valid captcha but unknown slug", async ({ request }) => {
    const { code, token } = await getCaptcha(request);
    const validPng = Buffer.from(
      "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c6260000000020001e221bc330000000049454e44ae426082",
      "hex",
    );
    const res = await request.post(`${BASE}/api/portal/unknown-slug-xyz/tickets`, {
      multipart: {
        name:          "Alice",
        email:         "alice@example.com",
        subject:       "Valid image test",
        body:          "Attaching a valid PNG.",
        captchaToken:  token,
        captchaAnswer: code!, // code is present in test mode via server backdoor
        attachments: {
          name:     "photo.png",
          mimeType: "image/png",
          buffer:   validPng,
        },
      },
    });
    // Multer accepted; schema passes; captcha passes; HRMS lookup fails → 404
    expect(res.status()).toBe(404);
  });
});

// ─── GET /api/portal/tickets/:id — attachments shape ─────────────────────────

test.describe("GET /api/portal/tickets/:id — attachments field", () => {
  let ticketId: string;
  let cookies: string;

  test.beforeAll(async ({ request }) => {
    // Log in as the previously created customer
    const loginRes = await loginAs(request, "portal-test@example.com", "SecurePass123");
    expect(loginRes.status()).toBe(200);
    cookies = loginRes.headers()["set-cookie"] ?? "";

    // Set portal client association so the customer can access their tickets
    const clientPatch = await request.patch(`${BASE}/api/portal/me/client`, {
      data:    { clientId: "test-client" },
      headers: { "Content-Type": "application/json", Cookie: cookies },
    });
    expect(clientPatch.status()).toBe(200);

    // Create a ticket via webhook (email) so we own it
    const tRes = await createTicketViaEmail(request, {
      from:         "portal-test@example.com",
      subject:      "Attachments shape test",
      body:         "Checking attachments array.",
      hrmsClientId: "test-client",
    });
    expect(tRes.status()).toBe(201);
    ticketId = (await tRes.json()).ticketId;
  });

  test("GET /tickets/:id — response includes an attachments array", async ({ request }) => {
    const res = await request.get(`${BASE}/api/portal/tickets/${ticketId}`, {
      headers: { Cookie: cookies },
    });
    expect(res.status()).toBe(200);
    const json = await res.json();
    // attachments must be an array (empty for webhook-created tickets)
    expect(Array.isArray(json.attachments)).toBe(true);
  });
});

// ─── Admin/Agent cannot access portal customer routes ─────────────────────────

test.describe("requireCustomer — admin is rejected from portal routes", () => {
  let adminCookies: string;

  test.beforeAll(async ({ request }) => {
    const loginRes = await loginAs(request, "admin@wisright.com", "Test@123");
    expect(loginRes.status()).toBe(200);
    adminCookies = loginRes.headers()["set-cookie"] ?? "";
  });

  test("GET /api/portal/tickets returns 403 for admin", async ({ request }) => {
    const res = await request.get(`${BASE}/api/portal/tickets`, {
      headers: { Cookie: adminCookies },
    });
    expect(res.status()).toBe(403);
    const json = await res.json();
    expect(json.error).toMatch(/customer/i);
  });
});

// ---------------------------------------------------------------------------
// Multi-description storage
// ---------------------------------------------------------------------------

test.describe("Multi-description body storage", () => {
  test("ticket description stores multiple sections joined by separator", async ({ request }) => {
    const body1 = "This is the first description of the issue.";
    const body2 = "This is the second description with more details.";
    const combined = `${body1}\n\n---\n\n${body2}`;

    const res = await createTicketViaEmail(request, {
      from:    "multidesc@example.com",
      subject: "Multi-description test ticket",
      body:    combined,
    });
    expect(res.status()).toBe(201);
    const { ticketId } = await res.json();

    // Fetch the ticket as admin and verify both sections are in the description
    const loginRes = await loginAs(request, "admin@wisright.com", "Test@123");
    expect(loginRes.status()).toBe(200);
    const adminCookies = loginRes.headers()["set-cookie"] ?? "";

    const tRes = await request.get(`${BASE}/api/tickets/${ticketId}`, {
      headers: { Cookie: adminCookies },
    });
    expect(tRes.status()).toBe(200);
    const ticket = await tRes.json();
    expect(ticket.description).toContain(body1);
    expect(ticket.description).toContain(body2);
    expect(ticket.description).toContain("\n\n---\n\n");
  });
});

// ---------------------------------------------------------------------------
// Ticket reopen
// ---------------------------------------------------------------------------

test.describe("Ticket reopen", () => {
  test.describe.configure({ mode: "serial" });

  const customerEmail    = "reopen-test-customer@example.com";
  const customerPassword = "ReopenPass123";
  let customerCookies: string;
  let adminCookies: string;
  let ticketId: string;

  test.beforeAll(async ({ request }) => {
    // Ensure customer account exists
    await request.post(`${BASE}/api/portal/auth/signup`, {
      data:    { name: "Reopen Customer", email: customerEmail, password: customerPassword },
      headers: { "Content-Type": "application/json" },
    });

    const loginRes = await loginAs(request, customerEmail, customerPassword);
    expect(loginRes.status()).toBe(200);
    customerCookies = loginRes.headers()["set-cookie"] ?? "";

    const adminLogin = await loginAs(request, "admin@wisright.com", "Test@123");
    expect(adminLogin.status()).toBe(200);
    adminCookies = adminLogin.headers()["set-cookie"] ?? "";

    // Create a ticket via email webhook so it gets a ticketId
    const ticketRes = await createTicketViaEmail(request, {
      from:    customerEmail,
      subject: "Ticket to be reopened",
      body:    "This ticket will be closed then reopened.",
    });
    expect(ticketRes.status()).toBe(201);
    const body = await ticketRes.json();
    ticketId = body.ticketId;

    // Close it as admin
    const closeRes = await request.patch(`${BASE}/api/tickets/${ticketId}/status`, {
      data:    { status: "CLOSED" },
      headers: { Cookie: adminCookies, "Content-Type": "application/json" },
    });
    expect(closeRes.status()).toBe(200);
  });

  test("customer can reopen a closed ticket", async ({ request }) => {
    const res = await request.post(`${BASE}/api/portal/tickets/${ticketId}/reopen`, {
      headers: { Cookie: customerCookies },
    });
    expect(res.status()).toBe(204);

    // Verify status changed to REOPENED
    const tRes = await request.get(`${BASE}/api/tickets/${ticketId}`, {
      headers: { Cookie: adminCookies },
    });
    expect(tRes.status()).toBe(200);
    const ticket = await tRes.json();
    expect(ticket.status).toBe("REOPENED");
  });

  test("cannot reopen a ticket that is not closed/done", async ({ request }) => {
    // Ticket is now REOPENED — trying to reopen again should fail
    const res = await request.post(`${BASE}/api/portal/tickets/${ticketId}/reopen`, {
      headers: { Cookie: customerCookies },
    });
    expect(res.status()).toBe(400);
  });

  test("non-owner customer cannot reopen another customer's ticket", async ({ request }) => {
    // Sign up a different customer
    const otherEmail = "reopen-other-customer@example.com";
    await request.post(`${BASE}/api/portal/auth/signup`, {
      data:    { name: "Other Customer", email: otherEmail, password: "OtherPass123" },
      headers: { "Content-Type": "application/json" },
    });
    const otherLogin = await loginAs(request, otherEmail, "OtherPass123");
    expect(otherLogin.status()).toBe(200);
    const otherCookies = otherLogin.headers()["set-cookie"] ?? "";

    // Close the ticket first via admin
    await request.patch(`${BASE}/api/tickets/${ticketId}/status`, {
      data:    { status: "CLOSED" },
      headers: { Cookie: adminCookies, "Content-Type": "application/json" },
    });

    const res = await request.post(`${BASE}/api/portal/tickets/${ticketId}/reopen`, {
      headers: { Cookie: otherCookies },
    });
    expect(res.status()).toBe(403);
  });
});
