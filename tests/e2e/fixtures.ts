import { test as base, type BrowserContext, type Page } from "@playwright/test";
import { encode } from "@auth/core/jwt";

export const TEST_USER = {
  id: "test-user-id-000000000001",
  name: "Test User",
  email: "test@example.com",
  image: "https://avatars.githubusercontent.com/u/0",
};

/**
 * Builds a valid Auth.js v5 JWT session cookie and adds it to the browser
 * context so the Next.js middleware and server components see an authenticated
 * session without performing a real OAuth flow.
 */
async function injectSession(context: BrowserContext) {
  const secret = process.env.AUTH_SECRET ?? "test-secret-minimum-32-characters-long-for-auth";

  const token = await encode({
    token: {
      sub: TEST_USER.id,
      name: TEST_USER.name,
      email: TEST_USER.email,
      picture: TEST_USER.image,
      userId: TEST_USER.id,
      // exp must be in the future
      exp: Math.floor(Date.now() / 1000) + 60 * 60,
    },
    secret,
    salt: "authjs.session-token",
  });

  await context.addCookies([
    {
      name: "authjs.session-token",
      value: token,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}

/** Fixture that provides a page pre-loaded with a valid session cookie. */
export const test = base.extend<{ authenticatedPage: Page }>({
  authenticatedPage: async ({ context, page }, use) => {
    await injectSession(context);
    await use(page);
  },
});

export { expect } from "@playwright/test";
