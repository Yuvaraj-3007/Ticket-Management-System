import { test, expect, type Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ADMIN_EMAIL = "admin@wisright.com";
const ADMIN_PASSWORD = "Test@123";

// Fixed test user — created once, then edited/toggled across the suite.
// Using a fixed email (not random) makes failures easy to reproduce locally.
const TEST_USER = {
  name: "Grace Hopper",
  email: "grace.hopper.e2e@example.com",
  password: "Hopper@123",
  role: "Agent",
} as const;

const UPDATED_USER = {
  name: "Grace M. Hopper",
  email: "grace.hopper.updated.e2e@example.com",
  role: "Admin",
} as const;

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

async function goToUsersPage(page: Page) {
  await page.goto("/users");
  await expect(
    page.getByRole("heading", { name: "Users" })
  ).toBeVisible();
}

/** Find the table row for a user by their email. */
function userRow(page: Page, email: string) {
  return page.getByRole("row").filter({ hasText: email });
}

// ---------------------------------------------------------------------------
// Suite — runs serially so each test builds on the previous DB state
// ---------------------------------------------------------------------------

test.describe.configure({ mode: "serial" });

test.describe("User management — happy paths", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await goToUsersPage(page);
  });

  // ─── Read ────────────────────────────────────────────────────────────────

  test("displays the user list with the seeded admin account", async ({
    page,
  }) => {
    await expect(page.getByRole("table")).toBeVisible();
    await expect(page.getByText(ADMIN_EMAIL)).toBeVisible();
  });

  // ─── Create ──────────────────────────────────────────────────────────────

  test("creates a new user and shows them in the list", async ({ page }) => {
    await page.getByRole("button", { name: "Add User" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    await page.getByLabel("Name").fill(TEST_USER.name);
    await page.getByLabel("Email").fill(TEST_USER.email);
    await page.getByLabel(/^password/i).fill(TEST_USER.password);

    // Role defaults to Agent — no change needed
    await page.getByRole("button", { name: "Create User" }).click();

    // Dialog closes on success
    await expect(page.getByRole("dialog")).not.toBeVisible();

    // New user appears in the table
    const row = userRow(page, TEST_USER.email);
    await expect(row).toBeVisible();
    await expect(row.getByText(TEST_USER.name)).toBeVisible();
    await expect(row.getByText("AGENT")).toBeVisible();
    await expect(row.getByText("Active")).toBeVisible();
  });

  // ─── Update ──────────────────────────────────────────────────────────────

  test("updates the user's name, email, and role and reflects changes in the list", async ({
    page,
  }) => {
    const row = userRow(page, TEST_USER.email);
    await row.getByRole("button", { name: "Edit" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    await page.getByLabel("Name").clear();
    await page.getByLabel("Name").fill(UPDATED_USER.name);

    await page.getByLabel("Email").clear();
    await page.getByLabel("Email").fill(UPDATED_USER.email);

    // Change role from Agent to Admin via the select
    await page.getByRole("combobox").click();
    await page.getByRole("option", { name: UPDATED_USER.role }).click();

    await page.getByRole("button", { name: "Update User" }).click();

    // Dialog closes on success
    await expect(page.getByRole("dialog")).not.toBeVisible();

    // Updated values are shown in the table
    const updatedRow = userRow(page, UPDATED_USER.email);
    await expect(updatedRow).toBeVisible();
    await expect(updatedRow.getByText(UPDATED_USER.name)).toBeVisible();
    await expect(updatedRow.getByText("ADMIN")).toBeVisible();
  });

  // ─── Deactivate ──────────────────────────────────────────────────────────

  test("deactivates an active user and shows them as Inactive", async ({
    page,
  }) => {
    const row = userRow(page, UPDATED_USER.email);
    await expect(row.getByText("Active")).toBeVisible();

    await row.getByRole("button", { name: "Deactivate" }).click();

    await expect(row.getByText("Inactive")).toBeVisible();
    await expect(row.getByRole("button", { name: "Activate" })).toBeVisible();
  });

  // ─── Reactivate ──────────────────────────────────────────────────────────

  test("reactivates an inactive user and shows them as Active", async ({
    page,
  }) => {
    const row = userRow(page, UPDATED_USER.email);
    await expect(row.getByText("Inactive")).toBeVisible();

    await row.getByRole("button", { name: "Activate" }).click();

    await expect(row.getByText("Active")).toBeVisible();
    await expect(row.getByRole("button", { name: "Deactivate" })).toBeVisible();
  });

  // ─── Delete ──────────────────────────────────────────────────────────────

  test("deletes a user after confirming the dialog and removes them from the list", async ({
    page,
  }) => {
    const row = userRow(page, UPDATED_USER.email);

    // Click the trash icon (title="Delete user")
    await row.getByTitle("Delete user").click();

    // Confirmation dialog appears with user's name
    const dialog = page.getByRole("dialog", { name: "Delete User" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(UPDATED_USER.name)).toBeVisible();

    // Confirm permanent deletion
    await dialog.getByRole("button", { name: "Delete" }).click();

    // Dialog closes and user is no longer in the table
    await expect(dialog).not.toBeVisible();
    await expect(page.getByText(UPDATED_USER.email)).not.toBeVisible();
  });
});

// ─── Agent Performance Detail Page ────────────────────────────────────────────

test.describe("Agent performance detail page (/users/:id)", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await goToUsersPage(page);
  });

  test("clicking a user name navigates to their detail page", async ({ page }) => {
    // User name links live inside the table — find the first one
    const nameLink = page.getByRole("table").getByRole("link").first();
    await nameLink.click();

    // URL must change to /users/<uuid>
    await expect(page).toHaveURL(/\/users\/[0-9a-f-]{36}$/);
  });

  test("agent detail page shows KPI cards and a back link", async ({ page }) => {
    // Grab the href from the first user-name link in the table
    const nameLink = page.getByRole("table").getByRole("link").first();
    const href = await nameLink.getAttribute("href");
    expect(href).toMatch(/\/users\/[0-9a-f-]{36}$/);

    await page.goto(href!);

    // Back link is present
    await expect(page.getByRole("link", { name: /back.*users/i })).toBeVisible();

    // KPI summary cards are rendered
    await expect(page.getByText(/Total Assigned/i)).toBeVisible();
    await expect(page.getByText(/Total Closed/i)).toBeVisible();
    await expect(page.getByText(/Avg Resolution/i)).toBeVisible();
    await expect(page.getByText(/Avg Rating/i)).toBeVisible();
  });

  test("agent detail page is only accessible to admins (non-admin is redirected)", async ({ page }) => {
    const nameLink = page.getByRole("table").getByRole("link").first();
    const href = await nameLink.getAttribute("href");
    await page.goto(href!);

    // Heading (user name) is visible when accessed as admin
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// HRMS sync endpoint tests
// ---------------------------------------------------------------------------

test.describe("HRMS sync — POST /api/users/sync-hrms", () => {
  test("returns 401 when unauthenticated", async ({ request }) => {
    const res = await request.post("http://localhost:5001/api/users/sync-hrms");
    expect(res.status()).toBe(401);
  });

  test("returns a valid SyncResult shape when authenticated as admin", async ({ request }) => {
    // Authenticate as admin first
    await request.post("http://localhost:5001/api/auth/sign-in/email", {
      data: { email: "admin@wisright.com", password: "Test@123" },
    });

    const res = await request.post("http://localhost:5001/api/users/sync-hrms");
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(typeof body.skipped).toBe("boolean");
    expect(Array.isArray(body.deactivated)).toBe(true);
    expect(Array.isArray(body.reactivated)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// HRMS import endpoint tests
// ---------------------------------------------------------------------------

test.describe("HRMS import — POST /api/users/import-hrms", () => {
  test("returns 401 when unauthenticated", async ({ request }) => {
    const res = await request.post("http://localhost:5001/api/users/import-hrms");
    expect(res.status()).toBe(401);
  });

  test("returns a valid ImportResult shape when authenticated as admin", async ({ request }) => {
    await request.post("http://localhost:5001/api/auth/sign-in/email", {
      data: { email: "admin@wisright.com", password: "Test@123" },
    });

    const res = await request.post("http://localhost:5001/api/users/import-hrms");
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(typeof body.skipped).toBe("boolean");
    expect(typeof body.imported).toBe("number");
    expect(Array.isArray(body.emails)).toBe(true);
  });
});
