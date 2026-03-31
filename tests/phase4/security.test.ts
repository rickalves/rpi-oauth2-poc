/**
 * Phase 4 — Security & Polish
 *
 * Automated acceptance checks for Tasks 15–17 of the PLAN.md.
 * All tests use static file analysis (fs) — no live server or TypeScript
 * compiler invocation is required. Manual-only criteria are noted inline.
 */

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

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
// Task 15 — Verify CSRF Protection (no code required — Auth.js native)
// ---------------------------------------------------------------------------

describe("Task 15 — CSRF Protection (Auth.js native)", () => {
  it("route handler exists at src/app/api/auth/[...nextauth]/route.ts (CSRF endpoint exposed)", () => {
    expect(fileExists("src/app/api/auth/[...nextauth]/route.ts")).toBe(true);
  });

  it("route handler exports GET (required for /api/auth/csrf endpoint)", () => {
    const content = readFile("src/app/api/auth/[...nextauth]/route.ts");
    expect(content).toMatch(/GET/);
  });

  it("route handler exports POST (required for CSRF-protected sign-in actions)", () => {
    const content = readFile("src/app/api/auth/[...nextauth]/route.ts");
    expect(content).toMatch(/POST/);
  });

  it("proxy does not bypass CSRF — no manual CSRF suppression in auth config", () => {
    const content = readFile("src/auth.ts");
    // Auth.js has no public API to disable CSRF; guard against accidental
    // monkey-patching or undocumented overrides in the config object.
    expect(content).not.toMatch(/skipCSRF|csrf\s*:\s*false|disableCSRF/i);
  });

  /**
   * NOTE: Runtime CSRF checks (endpoint response, cookie presence, POST
   * rejection without token) are manual acceptance checks requiring a
   * running Next.js server with valid credentials.
   */
});

// ---------------------------------------------------------------------------
// Task 16 — TypeScript Type Extensions (src/types/next-auth.d.ts)
// ---------------------------------------------------------------------------

describe("Task 16 — TypeScript Type Extensions (src/types/next-auth.d.ts)", () => {
  const FILE = "src/types/next-auth.d.ts";

  it("src/types/next-auth.d.ts exists", () => {
    expect(fileExists(FILE)).toBe(true);
  });

  it('augments the Session interface with an id field in the "next-auth" module', () => {
    const content = readFile(FILE);
    expect(content).toMatch(/declare\s+module\s+["']next-auth["']/);
    expect(content).toMatch(/interface\s+Session/);
    expect(content).toMatch(/id\s*:\s*string/);
  });

  it("preserves default Session.user fields via DefaultSession intersection", () => {
    const content = readFile(FILE);
    expect(content).toMatch(/DefaultSession\["user"\]/);
  });

  it('augments the JWT interface with userId in the "next-auth/jwt" module', () => {
    const content = readFile(FILE);
    expect(content).toMatch(/declare\s+module\s+["']next-auth\/jwt["']/);
    expect(content).toMatch(/interface\s+JWT/);
    expect(content).toMatch(/userId\s*\??\s*:\s*string/);
  });

  it("JWT interface extends DefaultJWT", () => {
    const content = readFile(FILE);
    expect(content).toMatch(/JWT\s+extends\s+DefaultJWT/);
  });

  it("tsconfig.json includes src/**/* so the declaration file is picked up", () => {
    const tsconfig = readFile("tsconfig.json");
    const parsed = JSON.parse(tsconfig);
    const include: string[] = parsed.include ?? [];
    const coversAll =
      include.some((p: string) => p === "**/*.ts" || p === "**/*.tsx") ||
      include.some((p: string) => p.startsWith("src/"));
    expect(coversAll).toBe(true);
  });

  it("npx tsc --noEmit exits with code 0 (zero TypeScript errors)", () => {
    let result = 0;
    try {
      execSync("npx tsc --noEmit", { cwd: ROOT, stdio: "pipe" });
    } catch {
      result = 1;
    }
    expect(result).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Task 17 — Verify .gitignore
// ---------------------------------------------------------------------------

describe("Task 17 — Verify .gitignore", () => {
  const FILE = ".gitignore";

  it(".gitignore exists", () => {
    expect(fileExists(FILE)).toBe(true);
  });

  it("ignores .env.local (via .env* glob or explicit entry)", () => {
    const content = readFile(FILE);
    expect(content).toMatch(/\.env\*|\.env\.local/);
  });

  it("ignores .env*.local variants", () => {
    const content = readFile(FILE);
    // Matches either .env*.local or the broader .env* glob
    expect(content).toMatch(/\.env\*/);
  });

  it("does not ignore .env.example (negation pattern present)", () => {
    const content = readFile(FILE);
    expect(content).toMatch(/!\.env\.example/);
  });

  it("ignores node_modules/", () => {
    const content = readFile(FILE);
    expect(content).toMatch(/node_modules/);
  });

  it("ignores .next/ build output", () => {
    const content = readFile(FILE);
    expect(content).toMatch(/\.next\//);
  });

  it(".env.local is not tracked by git (git check-ignore confirms it is ignored)", () => {
    let ignored = false;
    try {
      execSync("git check-ignore -q .env.local", { cwd: ROOT, stdio: "pipe" });
      ignored = true;
    } catch {
      ignored = false;
    }
    expect(ignored).toBe(true);
  });

  it(".env.example is tracked by git (not ignored)", () => {
    let notIgnored = false;
    try {
      execSync("git check-ignore -q .env.example", {
        cwd: ROOT,
        stdio: "pipe",
      });
      // exit 0 means it IS ignored — we want the opposite
      notIgnored = false;
    } catch {
      // non-zero exit means it is NOT ignored → good
      notIgnored = true;
    }
    expect(notIgnored).toBe(true);
  });
});
