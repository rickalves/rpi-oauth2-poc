/**
 * Phase 2 — Infrastructure
 *
 * Automated acceptance checks for Tasks 5–8 of the PLAN.md.
 * All tests use static file analysis (fs) — no live MongoDB or Auth.js
 * runtime is required. Manual-only criteria are noted inline.
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
// Task 5 — Create MongoDB Singleton (src/lib/mongodb.ts)
// ---------------------------------------------------------------------------

describe("Task 5 — Create MongoDB Singleton (src/lib/mongodb.ts)", () => {
  const FILE = "src/lib/mongodb.ts";

  it("src/lib/mongodb.ts exists", () => {
    expect(fileExists(FILE)).toBe(true);
  });

  it('imports MongoClient from "mongodb"', () => {
    const content = readFile(FILE);
    expect(content).toMatch(
      /import\s+\{[^}]*MongoClient[^}]*\}\s+from\s+["']mongodb["']/
    );
  });

  it("throws on missing MONGODB_URI (fast-fail guard)", () => {
    const content = readFile(FILE);
    expect(content).toContain("MONGODB_URI");
    expect(content).toMatch(/throw new Error/);
    expect(content).toMatch(/Missing environment variable/);
  });

  it("caches the client on global._mongoClientPromise in development", () => {
    const content = readFile(FILE);
    expect(content).toContain("global._mongoClientPromise");
    expect(content).toMatch(/NODE_ENV.*development|development.*NODE_ENV/);
  });

  it("declares global._mongoClientPromise to satisfy TypeScript", () => {
    const content = readFile(FILE);
    expect(content).toMatch(/declare\s+global/);
    expect(content).toContain("_mongoClientPromise");
  });

  it("exports clientPromise as the default export", () => {
    const content = readFile(FILE);
    expect(content).toMatch(/export\s+default\s+clientPromise/);
  });
});

// ---------------------------------------------------------------------------
// Task 6 — Configure Auth.js (src/auth.ts)
// ---------------------------------------------------------------------------

describe("Task 6 — Configure Auth.js (src/auth.ts)", () => {
  const FILE = "src/auth.ts";

  it("src/auth.ts exists", () => {
    expect(fileExists(FILE)).toBe(true);
  });

  it('imports NextAuth from "next-auth"', () => {
    const content = readFile(FILE);
    expect(content).toMatch(/import\s+NextAuth\s+from\s+["']next-auth["']/);
  });

  it("imports Google and GitHub providers", () => {
    const content = readFile(FILE);
    expect(content).toMatch(
      /import\s+Google\s+from\s+["']next-auth\/providers\/google["']/
    );
    expect(content).toMatch(
      /import\s+GitHub\s+from\s+["']next-auth\/providers\/github["']/
    );
  });

  it("imports MongoDBAdapter from @auth/mongodb-adapter", () => {
    const content = readFile(FILE);
    expect(content).toMatch(
      /import\s+\{[^}]*MongoDBAdapter[^}]*\}\s+from\s+["']@auth\/mongodb-adapter["']/
    );
  });

  it("imports clientPromise from @/lib/mongodb", () => {
    const content = readFile(FILE);
    expect(content).toMatch(
      /import\s+clientPromise\s+from\s+["']@\/lib\/mongodb["']/
    );
  });

  it("exports auth, handlers, signIn, signOut", () => {
    const content = readFile(FILE);
    expect(content).toMatch(/export\s+const\s+\{[^}]*auth[^}]*\}/);
    expect(content).toContain("handlers");
    expect(content).toContain("signIn");
    expect(content).toContain("signOut");
  });

  it('uses JWT session strategy (session: { strategy: "jwt" })', () => {
    const content = readFile(FILE);
    expect(content).toMatch(/strategy\s*:\s*["']jwt["']/);
  });

  it("registers Google and GitHub as providers", () => {
    const content = readFile(FILE);
    expect(content).toMatch(/Google\s*\(/);
    expect(content).toMatch(/GitHub\s*\(/);
  });

  it("reads AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET from environment", () => {
    const content = readFile(FILE);
    expect(content).toContain("AUTH_GOOGLE_ID");
    expect(content).toContain("AUTH_GOOGLE_SECRET");
  });

  it("reads AUTH_GITHUB_ID and AUTH_GITHUB_SECRET from environment", () => {
    const content = readFile(FILE);
    expect(content).toContain("AUTH_GITHUB_ID");
    expect(content).toContain("AUTH_GITHUB_SECRET");
  });

  it("jwt callback maps user.id to token.userId", () => {
    const content = readFile(FILE);
    expect(content).toMatch(/jwt\s*\(\s*\{[^}]*token[^}]*user[^}]*\}/);
    expect(content).toContain("token.userId");
    expect(content).toContain("user.id");
  });

  it("session callback maps token.userId to session.user.id", () => {
    const content = readFile(FILE);
    expect(content).toMatch(/session\s*\(\s*\{[^}]*session[^}]*token[^}]*\}/);
    expect(content).toContain("session.user.id");
    expect(content).toContain("token.userId");
  });

  it("passes MongoDBAdapter with clientPromise to NextAuth", () => {
    const content = readFile(FILE);
    expect(content).toMatch(/MongoDBAdapter\s*\(\s*clientPromise\s*\)/);
  });
});

// ---------------------------------------------------------------------------
// Task 7 — Create Route Handler (src/app/api/auth/[...nextauth]/route.ts)
// ---------------------------------------------------------------------------

describe("Task 7 — Create Route Handler (src/app/api/auth/[...nextauth]/route.ts)", () => {
  const FILE = "src/app/api/auth/[...nextauth]/route.ts";

  it("src/app/api/auth/[...nextauth]/route.ts exists", () => {
    expect(fileExists(FILE)).toBe(true);
  });

  it('imports handlers from "@/auth"', () => {
    const content = readFile(FILE);
    expect(content).toMatch(
      /import\s+\{[^}]*handlers[^}]*\}\s+from\s+["']@\/auth["']/
    );
  });

  it("exports GET and POST from handlers", () => {
    const content = readFile(FILE);
    expect(content).toMatch(/export\s+const\s+\{[^}]*GET[^}]*\}/);
    expect(content).toContain("POST");
  });

  it("contains no extra logic beyond the handlers re-export", () => {
    const content = readFile(FILE);
    // Should be minimal: just an import and one export line
    const significantLines = content
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("//") && !l.startsWith("*"));
    expect(significantLines.length).toBeLessThanOrEqual(3);
  });

  /**
   * NOTE: "GET /api/auth/providers returns google and github" and
   * "GET /api/auth/csrf returns a CSRF token" are manual acceptance checks
   * that require a running Next.js server with valid credentials.
   */
});

// ---------------------------------------------------------------------------
// Task 8 — Create Proxy (src/proxy.ts)
// ---------------------------------------------------------------------------

describe("Task 8 — Create Proxy (src/proxy.ts)", () => {
  const FILE = "src/proxy.ts";

  it("src/proxy.ts exists", () => {
    expect(fileExists(FILE)).toBe(true);
  });

  it('imports auth from "@/auth"', () => {
    const content = readFile(FILE);
    expect(content).toMatch(
      /import\s+\{[^}]*auth[^}]*\}\s+from\s+["']@\/auth["']/
    );
  });

  it("uses auth as the default export (Auth.js v5 proxy pattern)", () => {
    const content = readFile(FILE);
    expect(content).toMatch(/export\s+default\s+auth\s*\(/);
  });

  it("redirects unauthenticated requests to /login", () => {
    const content = readFile(FILE);
    expect(content).toContain("/login");
    expect(content).toMatch(/Response\.redirect/);
  });

  it("exports config with matcher array", () => {
    const content = readFile(FILE);
    expect(content).toMatch(/export\s+const\s+config/);
    expect(content).toContain("matcher");
  });

  it("matcher protects /dashboard/:path*", () => {
    const content = readFile(FILE);
    expect(content).toContain("/dashboard/:path*");
  });

  it("does not import Node.js-only APIs (fs, crypto, path, os)", () => {
    const content = readFile(FILE);
    expect(content).not.toMatch(/from\s+["']fs["']/);
    expect(content).not.toMatch(/from\s+["']crypto["']/);
    expect(content).not.toMatch(/from\s+["']path["']/);
    expect(content).not.toMatch(/from\s+["']os["']/);
  });

  /**
   * NOTE: "GET /dashboard (unauthenticated) returns 302 to /login" and
   * "npm run build passes" are manual acceptance checks requiring a running
   * server and a full build, respectively.
   */
});
