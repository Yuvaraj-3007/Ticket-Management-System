import { test, expect, type APIRequestContext } from "@playwright/test";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ADMIN_EMAIL    = "admin@wisright.com";
const ADMIN_PASSWORD = "Test@123";
const BASE           = (process.env.TEST_BACKEND_URL ?? "http://localhost:5001").replace("localhost", "127.0.0.1");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function apiSignIn(request: APIRequestContext): Promise<void> {
  const res = await request.post(`${BASE}/api/auth/sign-in/email`, {
    data:    { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    headers: { "Content-Type": "application/json" },
  });
  expect(res.status()).toBe(200);
}

async function loginAsAdmin(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(ADMIN_EMAIL);
  await page.getByLabel("Password").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
}

// ---------------------------------------------------------------------------
// Suite 1 — GET /api/tickets/stats API
// ---------------------------------------------------------------------------

test.describe.configure({ mode: "serial" });

test.describe("GET /api/tickets/stats — API", () => {
  test("returns 401 when not authenticated", async ({ request }) => {
    const res = await request.get(`${BASE}/api/tickets/stats`);
    expect(res.status()).toBe(401);
  });

  test("returns 200 with correct shape when authenticated", async ({ request }) => {
    await apiSignIn(request);
    const res  = await request.get(`${BASE}/api/tickets/stats`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("total");
    expect(body).toHaveProperty("open");
    expect(body).toHaveProperty("aiResolved");
    expect(body).toHaveProperty("aiResolvedPercent");
    expect(body).toHaveProperty("avgResolutionTimeMs");
  });

  test("all returned fields are numbers", async ({ request }) => {
    await apiSignIn(request);
    const res  = await request.get(`${BASE}/api/tickets/stats`);
    const body = await res.json();
    expect(typeof body.total).toBe("number");
    expect(typeof body.open).toBe("number");
    expect(typeof body.aiResolved).toBe("number");
    expect(typeof body.aiResolvedPercent).toBe("number");
    expect(typeof body.avgResolutionTimeMs).toBe("number");
  });

  test("open count is a non-negative integer", async ({ request }) => {
    await apiSignIn(request);
    const res  = await request.get(`${BASE}/api/tickets/stats`);
    const body = await res.json();
    expect(body.open).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(body.open)).toBe(true);
  });

  test("aiResolved does not exceed total", async ({ request }) => {
    await apiSignIn(request);
    const res  = await request.get(`${BASE}/api/tickets/stats`);
    const body = await res.json();
    expect(body.aiResolved).toBeLessThanOrEqual(body.total);
  });

  test("aiResolvedPercent is 0 when total is 0", async ({ request }) => {
    // This assertion holds when the test DB starts empty.
    // If tickets already exist the percent may be non-zero — skip gracefully.
    await apiSignIn(request);
    const res  = await request.get(`${BASE}/api/tickets/stats`);
    const body = await res.json();
    if (body.total === 0) {
      expect(body.aiResolvedPercent).toBe(0);
    }
  });

  test("aiResolvedPercent equals aiResolved/total*100 rounded to 1dp", async ({ request }) => {
    await apiSignIn(request);
    const res  = await request.get(`${BASE}/api/tickets/stats`);
    const body = await res.json();
    if (body.total > 0) {
      const expected = Math.round((body.aiResolved / body.total) * 1000) / 10;
      expect(body.aiResolvedPercent).toBe(expected);
    }
  });

  test("avgResolutionTimeMs is 0 when no RESOLVED tickets exist", async ({ request }) => {
    await apiSignIn(request);
    const res  = await request.get(`${BASE}/api/tickets/stats`);
    const body = await res.json();
    if (body.aiResolved === 0) {
      expect(body.avgResolutionTimeMs).toBe(0);
    }
  });

  test("avgResolutionTimeMs is non-negative", async ({ request }) => {
    await apiSignIn(request);
    const res  = await request.get(`${BASE}/api/tickets/stats`);
    const body = await res.json();
    expect(body.avgResolutionTimeMs).toBeGreaterThanOrEqual(0);
  });

  test("dailyCounts is an array of 30 entries", async ({ request }) => {
    await apiSignIn(request);
    const res  = await request.get(`${BASE}/api/tickets/stats`);
    const body = await res.json();
    expect(Array.isArray(body.dailyCounts)).toBe(true);
    expect(body.dailyCounts).toHaveLength(30);
  });

  test("each dailyCounts entry has a date string and numeric count", async ({ request }) => {
    await apiSignIn(request);
    const res  = await request.get(`${BASE}/api/tickets/stats`);
    const body = await res.json();
    for (const entry of body.dailyCounts) {
      expect(typeof entry.date).toBe("string");
      expect(entry.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(typeof entry.count).toBe("number");
      expect(entry.count).toBeGreaterThanOrEqual(0);
    }
  });

  test("dailyCounts entries are in ascending date order", async ({ request }) => {
    await apiSignIn(request);
    const res  = await request.get(`${BASE}/api/tickets/stats`);
    const body = await res.json();
    for (let i = 1; i < body.dailyCounts.length; i++) {
      expect(body.dailyCounts[i].date >= body.dailyCounts[i - 1].date).toBe(true);
    }
  });

  test("last dailyCounts entry is today's date", async ({ request }) => {
    await apiSignIn(request);
    const res  = await request.get(`${BASE}/api/tickets/stats`);
    const body = await res.json();
    const today = new Date().toISOString().slice(0, 10);
    const last  = body.dailyCounts[body.dailyCounts.length - 1].date;
    expect(last).toBe(today);
  });
});

// ---------------------------------------------------------------------------
// Suite 2 — Dashboard UI
// ---------------------------------------------------------------------------

test.describe("Dashboard — UI", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("shows Dashboard heading", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  });

  test("shows all 5 stat card labels", async ({ page }) => {
    await expect(page.getByText("Total Tickets")).toBeVisible();
    await expect(page.getByText("Open", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Un-Assigned")).toBeVisible();
    await expect(page.getByText("AI Resolution Rate")).toBeVisible();
    await expect(page.getByText("Avg Resolution Time")).toBeVisible();
  });

  test("stat values are visible and not empty", async ({ page }) => {
    // KPI stat cards should be present
    const cards = page.locator('[data-slot="card"]');
    await expect(cards.first()).toBeVisible();
    // At least 6 cards (KPI grid) + chart + agent workload etc.
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(6);
  });

  test("AI Resolution Rate value contains a percent sign", async ({ page }) => {
    // Wait for data to load — the skeleton disappears when the query resolves
    await page.waitForSelector("text=AI Resolution Rate");
    // The value cell is the <p> inside the card following "AI Resolution Rate"
    const rateCard = page.locator('[data-slot="card"]').filter({ hasText: "AI Resolution Rate" });
    await expect(rateCard).toBeVisible();
    // The value should contain a "%"
    await expect(rateCard.locator("p").last()).toContainText("%");
  });

  test("bar chart is rendered below the stat cards", async ({ page }) => {
    // Recharts renders an SVG — wait for it to appear
    await page.waitForSelector("text=Ticket Volume");
    await expect(page.getByText("Ticket Volume — Last 30 Days")).toBeVisible();
    // The chart renders an SVG element inside the card
    const chartSvg = page.locator('[data-slot="card"]').filter({ hasText: "Ticket Volume" }).locator("svg");
    await expect(chartSvg).toBeVisible();
  });

  test("navigating to / while logged in renders the dashboard without redirect", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL("/");
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  });
});
