import { test, expect, type Page } from "@playwright/test";

async function loginAsAdmin(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill("admin@wisright.com");
  await page.getByLabel("Password").fill("Test@123");
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Sidebar nav item
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Internal tickets — sidebar nav", () => {
  test("My Tickets link is visible in the sidebar after login", async ({ page }) => {
    await loginAsAdmin(page);
    await expect(page.getByRole("link", { name: "My Tickets" })).toBeVisible();
  });

  test("clicking My Tickets navigates to /internal/tickets", async ({ page }) => {
    await loginAsAdmin(page);
    await page.getByRole("link", { name: "My Tickets" }).click();
    await expect(page).toHaveURL("/internal/tickets");
    await expect(page.getByRole("heading", { name: "My Tickets" })).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. My Tickets list page
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Internal tickets — list page", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/internal/tickets");
  });

  test("renders heading and New Ticket button", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "My Tickets" })).toBeVisible();
    await expect(page.getByRole("link", { name: /New Ticket/i })).toBeVisible();
  });

  test("New Ticket button navigates to submit form", async ({ page }) => {
    await page.getByRole("link", { name: /New Ticket/i }).click();
    await expect(page).toHaveURL("/internal/submit");
  });

  test("shows empty state or ticket table", async ({ page }) => {
    await page.waitForLoadState("networkidle");
    // Either empty-state message or the table header must be present
    const isEmpty = await page.getByText("No tickets yet").isVisible().catch(() => false);
    const hasTable = await page.getByRole("columnheader", { name: "Title" }).isVisible().catch(() => false);
    expect(isEmpty || hasTable).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Submit form
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Internal tickets — submit form", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/internal/submit");
  });

  test("renders all form fields", async ({ page }) => {
    await expect(page.getByLabel("Title")).toBeVisible();
    await expect(page.getByLabel("Description")).toBeVisible();
    await expect(page.getByRole("button", { name: /Submit Ticket/i })).toBeVisible();
  });

  test("shows validation error when title is empty", async ({ page }) => {
    await page.getByRole("button", { name: /Submit Ticket/i }).click();
    await expect(page.getByText("Title is required")).toBeVisible();
  });

  test("shows validation error when description is empty", async ({ page }) => {
    await page.getByLabel("Title").fill("Test title");
    await page.getByRole("button", { name: /Submit Ticket/i }).click();
    await expect(page.getByText("Description is required")).toBeVisible();
  });

  test("successful submission shows confirmation and navigates", async ({ page }) => {
    await page.getByLabel("Title").fill("Internal test ticket from Playwright");
    await page.getByLabel("Description").fill("This is a test ticket submitted via the internal portal during E2E tests.");
    await page.getByRole("button", { name: /Submit Ticket/i }).click();

    // Success state renders
    await expect(page.getByText("Ticket Submitted")).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("button", { name: "View My Tickets" })).toBeVisible();
  });

  test("after submission, ticket appears in My Tickets list", async ({ page }) => {
    const title = `E2E internal ticket ${Date.now()}`;
    await page.getByLabel("Title").fill(title);
    await page.getByLabel("Description").fill("Description for e2e test ticket");
    await page.getByRole("button", { name: /Submit Ticket/i }).click();
    await expect(page.getByText("Ticket Submitted")).toBeVisible({ timeout: 10000 });

    await page.getByRole("button", { name: "View My Tickets" }).click();
    await expect(page).toHaveURL("/internal/tickets");
    await expect(page.getByText(title)).toBeVisible({ timeout: 10000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Ticket detail page
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Internal tickets — detail page", () => {
  test("can navigate from list to detail and see ticket title", async ({ page }) => {
    await loginAsAdmin(page);

    // Submit a ticket first
    const title = `Detail test ${Date.now()}`;
    await page.goto("/internal/submit");
    await page.getByLabel("Title").fill(title);
    await page.getByLabel("Description").fill("Detail page E2E test description");
    await page.getByRole("button", { name: /Submit Ticket/i }).click();
    await expect(page.getByText("Ticket Submitted")).toBeVisible({ timeout: 10000 });

    // Navigate to list and click the ticket
    await page.goto("/internal/tickets");
    await expect(page.getByText(title)).toBeVisible({ timeout: 10000 });
    await page.getByText(title).click();

    // Should be on detail page showing the title
    await expect(page.getByText(title)).toBeVisible();
    await expect(page.getByRole("main").getByRole("link", { name: "My Tickets" })).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Unauthenticated access guard
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Internal tickets — auth guard", () => {
  test("unauthenticated user is redirected to login", async ({ page }) => {
    await page.goto("/internal/tickets");
    await expect(page).toHaveURL("/login");
  });

  test("unauthenticated user cannot access submit form", async ({ page }) => {
    await page.goto("/internal/submit");
    await expect(page).toHaveURL("/login");
  });
});
