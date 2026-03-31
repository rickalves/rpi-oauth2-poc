/**
 * Phase 3 — UI Authentication
 *
 * Automated acceptance checks for Tasks 9–14 of the PLAN.md.
 * All tests use static file analysis (fs) — no live server, browser, or
 * Auth.js runtime is required. Manual-only criteria are noted inline.
 */

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const ROOT = path.resolve(__dirname, "../..");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fileExists(rel: string): boolean {
  return fs.existsSync(path.join(ROOT, rel));
}

function readFile(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf-8");
}

// ---------------------------------------------------------------------------
// Task 9 — Create SessionProvider Wrapper
// (src/components/providers/session-provider.tsx)
// ---------------------------------------------------------------------------

describe("Task 9 — Create SessionProvider Wrapper (src/components/providers/session-provider.tsx)", () => {
  const FILE = "src/components/providers/session-provider.tsx";

  it("src/components/providers/session-provider.tsx exists", () => {
    expect(fileExists(FILE)).toBe(true);
  });

  it('has "use client" directive', () => {
    const content = readFile(FILE);
    expect(content).toMatch(/^["']use client["']/);
  });

  it('imports SessionProvider from "next-auth/react"', () => {
    const content = readFile(FILE);
    expect(content).toMatch(
      /import\s+\{[^}]*SessionProvider[^}]*\}\s+from\s+["']next-auth\/react["']/
    );
  });

  it('imports ReactNode from "react"', () => {
    const content = readFile(FILE);
    expect(content).toMatch(/import\s+type\s+\{[^}]*ReactNode[^}]*\}\s+from\s+["']react["']/);
  });

  it("default export wraps children in SessionProvider", () => {
    const content = readFile(FILE);
    expect(content).toMatch(/export\s+default\s+function/);
    expect(content).toMatch(/<SessionProvider>/);
    expect(content).toContain("children");
  });

  it("accepts a children prop typed as ReactNode", () => {
    const content = readFile(FILE);
    expect(content).toMatch(/children\s*[?:].*ReactNode/);
  });
});

// ---------------------------------------------------------------------------
// Task 10 — Update Root Layout (src/app/layout.tsx)
// ---------------------------------------------------------------------------

describe("Task 10 — Update Root Layout (src/app/layout.tsx)", () => {
  const FILE = "src/app/layout.tsx";

  it("src/app/layout.tsx exists", () => {
    expect(fileExists(FILE)).toBe(true);
  });

  it('imports Providers from "@/components/providers/session-provider"', () => {
    const content = readFile(FILE);
    expect(content).toMatch(
      /import\s+Providers\s+from\s+["']@\/components\/providers\/session-provider["']/
    );
  });

  it("wraps children with Providers component", () => {
    const content = readFile(FILE);
    expect(content).toMatch(/<Providers>/);
    expect(content).toMatch(/<\/Providers>/);
    expect(content).toContain("{children}");
  });

  it("exports metadata with a title", () => {
    const content = readFile(FILE);
    expect(content).toMatch(/export\s+const\s+metadata/);
    expect(content).toMatch(/title\s*:/);
  });

  it("has html and body elements in the layout", () => {
    const content = readFile(FILE);
    expect(content).toMatch(/<html/);
    expect(content).toMatch(/<body/);
  });

  it("does not import next/font (not needed for this POC)", () => {
    const content = readFile(FILE);
    expect(content).not.toMatch(/from\s+["']next\/font/);
  });

  /**
   * NOTE: "useSession() in a Client Component descendant does not throw
   * SessionProvider not found" is a manual runtime check.
   */
});

// ---------------------------------------------------------------------------
// Task 11 — Create Login Page (src/app/login/page.tsx)
// ---------------------------------------------------------------------------

describe("Task 11 — Create Login Page (src/app/login/page.tsx)", () => {
  const FILE = "src/app/login/page.tsx";

  it("src/app/login/page.tsx exists", () => {
    expect(fileExists(FILE)).toBe(true);
  });

  it('has "use client" directive', () => {
    const content = readFile(FILE);
    expect(content).toMatch(/^["']use client["']/);
  });

  it('imports signIn from "next-auth/react"', () => {
    const content = readFile(FILE);
    expect(content).toMatch(
      /import\s+\{[^}]*signIn[^}]*\}\s+from\s+["']next-auth\/react["']/
    );
  });

  it('calls signIn("google") with callbackUrl: "/dashboard"', () => {
    const content = readFile(FILE);
    expect(content).toMatch(/signIn\s*\(\s*["']google["']/);
    expect(content).toMatch(/callbackUrl\s*:\s*["']\/dashboard["']/);
  });

  it('calls signIn("github") with callbackUrl: "/dashboard"', () => {
    const content = readFile(FILE);
    expect(content).toMatch(/signIn\s*\(\s*["']github["']/);
  });

  it("renders a Google sign-in button", () => {
    const content = readFile(FILE);
    expect(content).toMatch(/Sign in with Google/i);
    expect(content).toMatch(/<button/);
  });

  it("renders a GitHub sign-in button", () => {
    const content = readFile(FILE);
    expect(content).toMatch(/Sign in with GitHub/i);
  });

  /**
   * NOTE: "GET /login renders with two buttons" and provider redirect tests
   * are manual acceptance checks requiring a running server.
   */
});

// ---------------------------------------------------------------------------
// Task 12 — Create Auth-Aware Header (src/components/header.tsx)
// ---------------------------------------------------------------------------

describe("Task 12 — Create Auth-Aware Header (src/components/header.tsx)", () => {
  const FILE = "src/components/header.tsx";

  it("src/components/header.tsx exists", () => {
    expect(fileExists(FILE)).toBe(true);
  });

  it('has "use client" directive', () => {
    const content = readFile(FILE);
    expect(content).toMatch(/^["']use client["']/);
  });

  it('imports useSession and signOut from "next-auth/react"', () => {
    const content = readFile(FILE);
    expect(content).toMatch(
      /import\s+\{[^}]*useSession[^}]*\}\s+from\s+["']next-auth\/react["']/
    );
    expect(content).toMatch(/signOut/);
  });

  it('imports Image from "next/image"', () => {
    const content = readFile(FILE);
    expect(content).toMatch(
      /import\s+Image\s+from\s+["']next\/image["']/
    );
  });

  it('imports Link from "next/link"', () => {
    const content = readFile(FILE);
    expect(content).toMatch(
      /import\s+Link\s+from\s+["']next\/link["']/
    );
  });

  it("calls useSession() to get session data", () => {
    const content = readFile(FILE);
    expect(content).toMatch(/useSession\s*\(\s*\)/);
  });

  it('calls signOut with callbackUrl: "/"', () => {
    const content = readFile(FILE);
    expect(content).toMatch(/signOut\s*\(/);
    expect(content).toMatch(/callbackUrl\s*:\s*["']\/["']/);
  });

  it("renders a Sign in link pointing to /login when unauthenticated", () => {
    const content = readFile(FILE);
    expect(content).toMatch(/href\s*=\s*[{["'].*\/login/);
    expect(content).toMatch(/Sign in/i);
  });

  it("renders a Sign out button when authenticated", () => {
    const content = readFile(FILE);
    expect(content).toMatch(/Sign out/i);
  });

  it("renders Next.js Image component for user avatar", () => {
    const content = readFile(FILE);
    expect(content).toMatch(/<Image/);
  });

  /**
   * NOTE: Visual rendering checks (avatar, name, sign-out click) are manual
   * acceptance checks requiring a running server and authenticated session.
   */
});

// ---------------------------------------------------------------------------
// Task 13 — Create Dashboard Page (src/app/dashboard/page.tsx)
// ---------------------------------------------------------------------------

describe("Task 13 — Create Dashboard Page (src/app/dashboard/page.tsx)", () => {
  const FILE = "src/app/dashboard/page.tsx";

  it("src/app/dashboard/page.tsx exists", () => {
    expect(fileExists(FILE)).toBe(true);
  });

  it('does not have "use client" (must be a Server Component)', () => {
    const content = readFile(FILE);
    expect(content).not.toMatch(/^["']use client["']/);
  });

  it('imports auth from "@/auth"', () => {
    const content = readFile(FILE);
    expect(content).toMatch(
      /import\s+\{[^}]*auth[^}]*\}\s+from\s+["']@\/auth["']/
    );
  });

  it('imports Header from "@/components/header"', () => {
    const content = readFile(FILE);
    expect(content).toMatch(
      /import\s+Header\s+from\s+["']@\/components\/header["']/
    );
  });

  it("exports an async default function (Server Component pattern)", () => {
    const content = readFile(FILE);
    expect(content).toMatch(/export\s+default\s+async\s+function/);
  });

  it("calls await auth() to retrieve session on the server", () => {
    const content = readFile(FILE);
    expect(content).toMatch(/await\s+auth\s*\(\s*\)/);
  });

  it("uses JSON.stringify to display session.user data", () => {
    const content = readFile(FILE);
    expect(content).toMatch(/JSON\.stringify\s*\(/);
    expect(content).toMatch(/session/);
  });

  it("renders the Header component", () => {
    const content = readFile(FILE);
    expect(content).toMatch(/<Header\s*\/>/);
  });

  it("does not use getServerSession (v4 API — must use auth() v5)", () => {
    const content = readFile(FILE);
    expect(content).not.toContain("getServerSession");
  });

  /**
   * NOTE: "Authenticated user sees name/email/image/id in JSON block" and
   * "session.user.id is present in output" are manual runtime checks.
   */
});

// ---------------------------------------------------------------------------
// Task 14 — Create Landing Page (src/app/page.tsx)
// ---------------------------------------------------------------------------

describe("Task 14 — Create Landing Page (src/app/page.tsx)", () => {
  const FILE = "src/app/page.tsx";

  it("src/app/page.tsx exists", () => {
    expect(fileExists(FILE)).toBe(true);
  });

  it('does not have "use client" (must be a Server Component)', () => {
    const content = readFile(FILE);
    expect(content).not.toMatch(/^["']use client["']/);
  });

  it('imports Link from "next/link"', () => {
    const content = readFile(FILE);
    expect(content).toMatch(
      /import\s+Link\s+from\s+["']next\/link["']/
    );
  });

  it('imports Header from "@/components/header"', () => {
    const content = readFile(FILE);
    expect(content).toMatch(
      /import\s+Header\s+from\s+["']@\/components\/header["']/
    );
  });

  it("renders the Header component", () => {
    const content = readFile(FILE);
    expect(content).toMatch(/<Header\s*\/>/);
  });

  it("has a link to /login (Sign In CTA)", () => {
    const content = readFile(FILE);
    expect(content).toMatch(/href\s*=\s*[{["'].*\/login/);
  });

  it("has a link to /dashboard (Dashboard CTA)", () => {
    const content = readFile(FILE);
    expect(content).toMatch(/href\s*=\s*[{["'].*\/dashboard/);
  });

  it("has an h1 heading with page title", () => {
    const content = readFile(FILE);
    expect(content).toMatch(/<h1/);
  });

  /**
   * NOTE: "GET / renders landing page with both CTAs" and "header shows
   * auth state" are manual acceptance checks requiring a running server.
   */
});

// ---------------------------------------------------------------------------
// Cross-cutting — next.config.ts image remote patterns
// ---------------------------------------------------------------------------

describe("next.config.ts — image remote patterns for avatar CDNs", () => {
  const FILE = "next.config.ts";

  it("next.config.ts exists", () => {
    expect(fileExists(FILE)).toBe(true);
  });

  it("configures remotePatterns for lh3.googleusercontent.com (Google avatars)", () => {
    const content = readFile(FILE);
    expect(content).toContain("lh3.googleusercontent.com");
  });

  it("configures remotePatterns for avatars.githubusercontent.com (GitHub avatars)", () => {
    const content = readFile(FILE);
    expect(content).toContain("avatars.githubusercontent.com");
  });
});
