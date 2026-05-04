import { defineConfig, devices } from "@playwright/test";
import path from "path";
import dotenv from "dotenv";

// Load .env.test so env vars are available to this config (webServer env)
dotenv.config({ path: path.resolve(__dirname, ".env.test") });

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: "list",

  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  globalSetup: "./tests/e2e/global-setup.ts",
  globalTeardown: "./tests/e2e/global-teardown.ts",

  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    env: {
      AUTH_SECRET: process.env.AUTH_SECRET!,
      AUTH_GOOGLE_ID: process.env.AUTH_GOOGLE_ID!,
      AUTH_GOOGLE_SECRET: process.env.AUTH_GOOGLE_SECRET!,
      AUTH_GITHUB_ID: process.env.AUTH_GITHUB_ID!,
      AUTH_GITHUB_SECRET: process.env.AUTH_GITHUB_SECRET!,
      MONGODB_URI: process.env.MONGODB_URI!,
      ENABLE_TEST_CREDENTIALS: process.env.ENABLE_TEST_CREDENTIALS!,
    },
  },
});
