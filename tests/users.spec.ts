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
    page.getByRole("heading", { name: "User Management" })
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
});
