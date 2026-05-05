import { test, expect } from "@playwright/test";

test.describe("Login page", () => {
  test("renders Google and GitHub sign-in buttons", async ({ page }) => {
    await page.goto("/login");

    await expect(page.getByRole("button", { name: /sign in with google/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in with github/i })).toBeVisible();
  });

  test("sign-in with test credentials redirects to /dashboard", async ({ page }) => {
    // Auth.js v5 built-in sign-in page — pass callbackUrl so successful sign-in lands on /dashboard
    await page.goto("/api/auth/signin?callbackUrl=%2Fdashboard");

    // Fill in the email field rendered by the Credentials provider form
    await page.getByLabel(/email/i).fill("test@example.com");
    await page.getByRole("button", { name: /sign in with test credentials/i }).click();

    // Should land on /dashboard after successful sign-in
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });
  });
});
