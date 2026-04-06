import { test, expect } from "@playwright/test";

test.describe("Smoke test", () => {
  test("app loads", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Right Tracker/i);
  });
});
