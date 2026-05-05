import { test, expect } from "./fixtures";
import { TEST_USER } from "./fixtures";

test.describe("Dashboard (authenticated)", () => {
  test("authenticated user accesses /dashboard without redirect", async ({ authenticatedPage: page }) => {
    await page.goto("/dashboard");

    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("dashboard displays session user data as JSON", async ({ authenticatedPage: page }) => {
    await page.goto("/dashboard");

    const body = await page.locator("body").textContent();
    expect(body).toContain(TEST_USER.email);
  });

  test("header shows authenticated user name", async ({ authenticatedPage: page }) => {
    await page.goto("/dashboard");

    await expect(page.locator("header, nav").getByText(TEST_USER.name)).toBeVisible();
  });

  test("header contains a Sign out button", async ({ authenticatedPage: page }) => {
    await page.goto("/dashboard");

    await expect(page.getByRole("button", { name: /sign out/i })).toBeVisible();
  });
});
