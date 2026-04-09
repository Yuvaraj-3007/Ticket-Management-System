/**
 * E2E tests for the three new frontend features:
 *  1. reCAPTCHA on portal submit forms
 *  2. Image upload in replies/comments
 *  3. Analytics page
 */
import { test, expect, type Page } from "@playwright/test";

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

// ---------------------------------------------------------------------------
// Feature 1: Custom CAPTCHA on portal submit forms
// ---------------------------------------------------------------------------

test.describe("Custom CAPTCHA on portal submit forms", () => {
  test("PortalSubmit page renders custom CAPTCHA widget", async ({ page }) => {
    // Mock session as unauthenticated to prevent redirect away from submit form
    await page.route(/\/api\/auth\/get-session/, (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(null) })
    );
    await page.route(/\/api\/portal\/test-slug$/, (route) =>
      route.fulfill({
        status:      200,
        contentType: "application/json",
        body:        JSON.stringify({ customerName: "Test Co", slug: "test-slug" }),
      })
    );
    await page.route(/\/api\/portal\/test-slug\/projects/, (route) =>
      route.fulfill({
        status:      200,
        contentType: "application/json",
        body:        JSON.stringify([]),
      })
    );
    await page.route(/\/api\/portal\/captcha/, (route) =>
      route.fulfill({
        status:      200,
        contentType: "application/json",
        body:        JSON.stringify({ code: "ABCDE", token: "test-token" }),
      })
    );

    await page.goto("/portal/test-slug");

    // Wait for the CAPTCHA widget — SimpleCaptcha renders an input for the code
    await expect(page.locator('input[placeholder="Enter code"]')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("canvas").first()).toBeAttached();
  });

  test("SubmitTicketModal renders custom CAPTCHA and submit is disabled without it", async ({ page }) => {
    // Login as a customer via API mock
    await page.route(/\/api\/auth\/get-session/, (route) =>
      route.fulfill({
        status:      200,
        contentType: "application/json",
        body:        JSON.stringify({
          user:    { id: "c1", name: "Customer", email: "c@test.com", role: "CUSTOMER" },
          session: { id: "s1" },
        }),
      })
    );
    await page.route(/\/api\/portal\/tickets\?/, (route) =>
      route.fulfill({
        status:      200,
        contentType: "application/json",
        body:        JSON.stringify({ data: [], total: 0, page: 1, pageSize: 10, totalPages: 0 }),
      })
    );
    await page.route(/\/api\/portal\/projects/, (route) =>
      route.fulfill({
        status:      200,
        contentType: "application/json",
        body:        JSON.stringify([{ id: "p1", projectCode: "P1", projectName: "Project One" }]),
      })
    );
    await page.route(/\/api\/portal\/captcha/, (route) =>
      route.fulfill({
        status:      200,
        contentType: "application/json",
        body:        JSON.stringify({ code: "ABCDE", token: "test-token" }),
      })
    );

    await page.goto("/portal/tickets");

    // Open the Submit a Ticket modal
    await page.getByRole("button", { name: /Submit a Ticket/i }).first().click();

    // The submit button should be present and disabled without completing CAPTCHA
    const submitBtn = page.getByRole("button", { name: /Submit Ticket/i });
    await expect(submitBtn).toBeVisible();
    await expect(submitBtn).toBeDisabled();

    // The custom CAPTCHA canvas should appear in the modal
    await expect(page.locator("canvas")).toBeAttached({ timeout: 10_000 });
  });
});

// ---------------------------------------------------------------------------
// Feature 2: Image upload in replies/comments
// ---------------------------------------------------------------------------

test.describe("Image upload in ticket replies", () => {
  test("Admin reply form has image upload field", async ({ page }) => {
    await loginAsAdmin(page);

    // Mock the ticket and comments endpoints
    await page.route(/\/api\/tickets\/TKT-0001$/, (route) =>
      route.fulfill({
        status:      200,
        contentType: "application/json",
        body:        JSON.stringify({
          id:          "t1",
          ticketId:    "TKT-0001",
          title:       "Test Ticket",
          description: "Description here",
          type:        "SUPPORT",
          priority:    "MEDIUM",
          status:      "OPEN_NOT_STARTED",
          project:     "General",
          assignedTo:  null,
          createdBy:   { id: "u1", name: "Admin" },
          senderName:  "Customer",
          senderEmail: "c@test.com",
          createdAt:   new Date().toISOString(),
          updatedAt:   new Date().toISOString(),
          attachments: [],
        }),
      })
    );
    await page.route(/\/api\/tickets\/TKT-0001\/comments$/, (route) => {
      if (route.request().method() === "GET") {
        return route.fulfill({
          status:      200,
          contentType: "application/json",
          body:        JSON.stringify([]),
        });
      }
      return route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ id: "c1" }) });
    });

    await page.goto("/tickets/TKT-0001");

    // The image upload field (hidden file input) should be present in the reply section
    await expect(
      page.locator("input[type='file']").first()
    ).toBeAttached({ timeout: 10_000 });
  });

  test("Portal reply form has image upload field", async ({ page }) => {
    // Mock customer session
    await page.route(/\/api\/auth\/get-session/, (route) =>
      route.fulfill({
        status:      200,
        contentType: "application/json",
        body:        JSON.stringify({
          user:    { id: "c1", name: "Customer", email: "c@test.com", role: "CUSTOMER" },
          session: { id: "s1" },
        }),
      })
    );
    await page.route(/\/api\/portal\/tickets\/TKT-0001$/, (route) =>
      route.fulfill({
        status:      200,
        contentType: "application/json",
        body:        JSON.stringify({
          id:          "t1",
          ticketId:    "TKT-0001",
          title:       "My Portal Ticket",
          description: "Customer description",
          status:      "OPEN_NOT_STARTED",
          priority:    "LOW",
          type:        "SUPPORT",
          project:     "General",
          hrmsProjectName: null,
          senderName:  "Customer",
          senderEmail: "c@test.com",
          createdAt:   new Date().toISOString(),
          updatedAt:   new Date().toISOString(),
          rating:      null,
          assignedTo:  null,
          attachments: [],
        }),
      })
    );
    await page.route(/\/api\/portal\/tickets\/TKT-0001\/comments$/, (route) =>
      route.fulfill({
        status:      200,
        contentType: "application/json",
        body:        JSON.stringify([]),
      })
    );

    await page.goto("/portal/tickets/TKT-0001");

    // Image upload field (hidden file input) should be present in the Add Reply section
    await expect(
      page.locator("input[type='file']").first()
    ).toBeAttached({ timeout: 10_000 });
  });

  test("Comments with attachments render thumbnails", async ({ page }) => {
    // Mock customer session
    await page.route(/\/api\/auth\/get-session/, (route) =>
      route.fulfill({
        status:      200,
        contentType: "application/json",
        body:        JSON.stringify({
          user:    { id: "c1", name: "Customer", email: "c@test.com", role: "CUSTOMER" },
          session: { id: "s1" },
        }),
      })
    );
    await page.route(/\/api\/portal\/tickets\/TKT-0001$/, (route) =>
      route.fulfill({
        status:      200,
        contentType: "application/json",
        body:        JSON.stringify({
          id:          "t1",
          ticketId:    "TKT-0001",
          title:       "My Portal Ticket",
          description: "Customer description",
          status:      "OPEN_NOT_STARTED",
          priority:    "LOW",
          type:        "SUPPORT",
          project:     "General",
          hrmsProjectName: null,
          senderName:  "Customer",
          senderEmail: "c@test.com",
          createdAt:   new Date().toISOString(),
          updatedAt:   new Date().toISOString(),
          rating:      null,
          assignedTo:  null,
          attachments: [],
        }),
      })
    );
    await page.route(/\/api\/portal\/tickets\/TKT-0001\/comments$/, (route) =>
      route.fulfill({
        status:      200,
        contentType: "application/json",
        body:        JSON.stringify([
          {
            id:         "comment-1",
            content:    "Here is a screenshot",
            senderType: "AGENT",
            author:     { name: "Agent Smith" },
            createdAt:  new Date().toISOString(),
            attachments: [
              {
                id:       "att-1",
                filename: "screenshot.png",
                url:      "https://example.com/screenshot.png",
              },
            ],
          },
        ]),
      })
    );

    await page.goto("/portal/tickets/TKT-0001");

    // Comment with attachment should show the thumbnail image
    await expect(page.locator('img[alt="screenshot.png"]')).toBeVisible({ timeout: 10_000 });
    // Should link to the attachment URL
    await expect(
      page.locator('a[href="https://example.com/screenshot.png"]')
    ).toBeAttached();
  });
});

// ---------------------------------------------------------------------------
// Feature 3: Analytics page
// ---------------------------------------------------------------------------

test.describe("Analytics page", () => {
  const mockAnalytics = {
    total:               42,
    byStatus:            [
      { status: "OPEN_NOT_STARTED", count: 10 },
      { status: "OPEN_IN_PROGRESS", count: 8  },
      { status: "OPEN_QA",          count: 4  },
      { status: "OPEN_DONE",        count: 3  },
      { status: "CLOSED",           count: 15 },
      { status: "UN_ASSIGNED",      count: 2  },
    ],
    byType:              [
      { type: "SUPPORT",     count: 20 },
      { type: "BUG",         count: 12 },
      { type: "TASK",        count: 8  },
      { type: "REQUIREMENT", count: 2  },
    ],
    byPriority:          [
      { priority: "LOW",      count: 10 },
      { priority: "MEDIUM",   count: 20 },
      { priority: "HIGH",     count: 8  },
      { priority: "CRITICAL", count: 4  },
    ],
    agentStats:          [
      { id: "a1", name: "Alice Agent", role: "AGENT", assignedTickets: 15, commentsMade: 30 },
      { id: "a2", name: "Bob Admin",   role: "ADMIN", assignedTickets: 10, commentsMade: 20 },
    ],
    dailyVolume:         Array.from({ length: 7 }, (_, i) => ({
      date:  new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10),
      count: Math.floor(Math.random() * 5) + 1,
    })),
    avgResolutionHours:      24.5,
    avgRating:               4.2,
    ratedCount:              10,
    ratingDistribution:      [
      { stars: 5, count: 6 },
      { stars: 4, count: 3 },
      { stars: 3, count: 1 },
    ],
    byClient:                [
      { clientId: "c1", clientName: "Acme Corp", count: 20 },
      { clientId: "c2", clientName: "Beta Inc",  count: 22 },
    ],
    avgResolutionByPriority: [
      { priority: "LOW",      avgHours: 10 },
      { priority: "MEDIUM",   avgHours: 20 },
      { priority: "HIGH",     avgHours: 30 },
      { priority: "CRITICAL", avgHours: 5  },
    ],
  };

  test("Analytics page is accessible from sidebar for admin", async ({ page }) => {
    await loginAsAdmin(page);

    await page.route(/\/api\/analytics\/overview/, (route) =>
      route.fulfill({
        status:      200,
        contentType: "application/json",
        body:        JSON.stringify(mockAnalytics),
      })
    );

    // The Analytics nav link should be visible in the sidebar
    await expect(page.getByRole("link", { name: /Analytics/i })).toBeVisible();
  });

  test("Analytics page renders summary cards", async ({ page }) => {
    await loginAsAdmin(page);

    await page.route(/\/api\/analytics\/overview/, (route) =>
      route.fulfill({
        status:      200,
        contentType: "application/json",
        body:        JSON.stringify(mockAnalytics),
      })
    );

    await page.goto("/analytics");

    // Summary cards
    await expect(page.getByText("Total Tickets")).toBeVisible();
    await expect(page.getByText("42")).toBeVisible();
    await expect(page.getByText("Avg Resolution", { exact: true })).toBeVisible();
    await expect(page.getByText("24.5h")).toBeVisible();
  });

  test("Analytics page renders charts and agent table", async ({ page }) => {
    await loginAsAdmin(page);

    await page.route(/\/api\/analytics\/overview/, (route) =>
      route.fulfill({
        status:      200,
        contentType: "application/json",
        body:        JSON.stringify(mockAnalytics),
      })
    );

    await page.goto("/analytics");

    // Section headings (use role heading to be precise)
    await expect(page.getByRole("heading", { name: "Status Breakdown" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Priority Breakdown" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Agent Performance" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Category Breakdown" })).toBeVisible();

    // Agent table rows
    await expect(page.getByText("Alice Agent")).toBeVisible();
    await expect(page.getByText("Bob Admin")).toBeVisible();
  });

  test("Analytics page shows error state on API failure", async ({ page }) => {
    await loginAsAdmin(page);

    await page.route(/\/api\/analytics\/overview/, (route) =>
      route.fulfill({ status: 500, body: "Internal Server Error" })
    );

    await page.goto("/analytics");

    await expect(
      page.getByText(/Failed to load analytics/i)
    ).toBeVisible({ timeout: 10_000 });
  });

  test("Analytics page shows loading skeleton", async ({ page }) => {
    await loginAsAdmin(page);

    // Delay the response to catch the loading state
    await page.route(/\/api\/analytics\/overview/, async (route) => {
      await new Promise((r) => setTimeout(r, 2_000));
      await route.fulfill({
        status:      200,
        contentType: "application/json",
        body:        JSON.stringify(mockAnalytics),
      });
    });

    await page.goto("/analytics");

    // Skeleton should appear before data loads
    await expect(page.locator(".animate-pulse").first()).toBeVisible({ timeout: 5_000 });
  });

  test("Analytics route is admin-only — agents are redirected", async ({ page }) => {
    // Mock an agent session
    await page.route(/\/api\/auth\/get-session/, (route) =>
      route.fulfill({
        status:      200,
        contentType: "application/json",
        body:        JSON.stringify({
          user:    { id: "a1", name: "Agent", email: "agent@test.com", role: "AGENT" },
          session: { id: "s1" },
        }),
      })
    );

    await page.goto("/analytics");

    // Should be redirected away from /analytics
    await expect(page).not.toHaveURL("/analytics");
  });
});
