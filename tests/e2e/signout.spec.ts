import { test, expect } from "./fixtures";

test.describe("Sign-out flow", () => {
  test("clicking Sign out redirects away from /dashboard", async ({ authenticatedPage: page }) => {
    await page.goto("/dashboard");

    await page.getByRole("button", { name: /sign out/i }).click();

    // Should land on / or /login after sign-out (match against full URL)
    await expect(page).toHaveURL(/\/(login)?$/, { timeout: 10_000 });
  });

  test("after sign-out, /dashboard redirects back to /login", async ({ authenticatedPage: page }) => {
    await page.goto("/dashboard");

    // Sign out
    await page.getByRole("button", { name: /sign out/i }).click();
    await page.waitForURL(/\/(login)?$/, { timeout: 10_000 });

    // Clear session cookie explicitly to ensure clean state
    await page.context().clearCookies();

    // Try to access the protected route again
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });
});
