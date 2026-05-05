import { test, expect } from "@playwright/test";

test.describe("Public routes", () => {
  test("landing page (/) renders heading and navigation links", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator("h1")).toBeVisible();
    await expect(page.getByRole("link", { name: /sign in/i }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /dashboard/i })).toBeVisible();
  });

  test("GET /dashboard without session redirects to /login", async ({ page }) => {
    // Clear any cookies to ensure unauthenticated state
    await page.context().clearCookies();
    await page.goto("/dashboard");

    await expect(page).toHaveURL(/\/login/);
  });
});
