/**
 * Phase 1 — Project Setup
 *
 * Automated acceptance checks for Tasks 1–4 of the PLAN.md.
 * Each test maps to a specific acceptance criterion in the plan.
 * Manual-only criteria (e.g., "npm run dev starts") are noted but not run here.
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

function readJson(rel: string): Record<string, unknown> {
  return JSON.parse(readFile(rel));
}

// ---------------------------------------------------------------------------
// Task 1 — Initialize Next.js Project
// ---------------------------------------------------------------------------

describe("Task 1 — Initialize Next.js Project", () => {
  it("src/app/layout.tsx exists", () => {
    expect(fileExists("src/app/layout.tsx")).toBe(true);
  });

  it("src/app/layout.tsx contains App Router root layout structure", () => {
    const content = readFile("src/app/layout.tsx");
    expect(content).toContain("RootLayout");
    expect(content).toContain("<html");
    expect(content).toContain("{children}");
  });

  it('tsconfig.json includes "paths": { "@/*": ["./src/*"] }', () => {
    const tsconfig = readJson("tsconfig.json") as {
      compilerOptions?: { paths?: Record<string, string[]> };
    };
    expect(tsconfig.compilerOptions?.paths).toMatchObject({
      "@/*": ["./src/*"],
    });
  });

  it("tsconfig.json include covers src/**/*", () => {
    const tsconfig = readJson("tsconfig.json") as { include?: string[] };
    const includesAll = tsconfig.include?.some(
      (p) => p === "**/*.ts" || p === "**/*.tsx" || p.startsWith("src")
    );
    expect(includesAll).toBe(true);
  });

  /**
   * NOTE: "npm run dev starts without errors on http://localhost:3000"
   * is a manual acceptance criterion. Automated proxy: TypeScript compiles
   * with zero errors (verified via `npm run type-check`).
   */
  it("package.json includes dev script (proxy for npm run dev check)", () => {
    const pkg = readJson("package.json") as {
      scripts?: Record<string, string>;
    };
    expect(pkg.scripts?.dev).toBeDefined();
    expect(pkg.scripts?.dev).toContain("next dev");
  });
});

// ---------------------------------------------------------------------------
// Task 2 — Install Authentication Dependencies
// ---------------------------------------------------------------------------

describe("Task 2 — Install Authentication Dependencies", () => {
  it("next-auth is installed in node_modules", () => {
    expect(fileExists("node_modules/next-auth")).toBe(true);
  });

  it("@auth/mongodb-adapter is installed in node_modules", () => {
    expect(fileExists("node_modules/@auth/mongodb-adapter")).toBe(true);
  });

  it("mongodb driver is installed in node_modules", () => {
    expect(fileExists("node_modules/mongodb")).toBe(true);
  });

  it("package.json lists next-auth as a dependency", () => {
    const pkg = readJson("package.json") as {
      dependencies?: Record<string, string>;
    };
    expect(pkg.dependencies?.["next-auth"]).toBeDefined();
    expect(pkg.dependencies?.["next-auth"]).toMatch(/beta|5\./);
  });

  it("package.json lists @auth/mongodb-adapter as a dependency", () => {
    const pkg = readJson("package.json") as {
      dependencies?: Record<string, string>;
    };
    expect(pkg.dependencies?.["@auth/mongodb-adapter"]).toBeDefined();
  });

  it("package.json lists mongodb as a dependency", () => {
    const pkg = readJson("package.json") as {
      dependencies?: Record<string, string>;
    };
    expect(pkg.dependencies?.["mongodb"]).toBeDefined();
  });

  /**
   * NOTE: "npm run build produces no missing-module errors" is a manual check.
   * Automated proxy: build script exists and TypeScript resolves all imports
   * (covered by `npm run type-check`).
   */
  it("package.json includes build script", () => {
    const pkg = readJson("package.json") as {
      scripts?: Record<string, string>;
    };
    expect(pkg.scripts?.build).toBeDefined();
    expect(pkg.scripts?.build).toContain("next build");
  });
});

// ---------------------------------------------------------------------------
// Task 3 — Configure Environment Variables
// ---------------------------------------------------------------------------

describe("Task 3 — Configure Environment Variables", () => {
  /**
   * NOTE: ".env.local exists at the project root" and
   * "All 6 variables are populated with real values" are manual checks —
   * the file holds secrets and must never be committed.
   * Automated check: .gitignore ensures it stays out of git.
   */
  it(".env.local is excluded by .gitignore", () => {
    const gitignore = readFile(".gitignore");
    // Accepts .env*, .env*.local, or .env.local as valid patterns
    expect(gitignore).toMatch(/\.env(\*|\.local|\*\.local)/);
  });

  it(".env.local is not tracked in the repository (git check)", () => {
    // The actual runtime check is: git check-ignore -v .env.local
    // Here we verify the gitignore rule covers it.
    const gitignore = readFile(".gitignore");
    const patterns = gitignore
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    const covered = patterns.some(
      (p) =>
        p === ".env.local" ||
        p === ".env*.local" ||
        p === "*.local" ||
        p === ".env*"
    );
    expect(covered).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Task 4 — Create .env.example
// ---------------------------------------------------------------------------

describe("Task 4 — Create .env.example", () => {
  const ENV_EXAMPLE = ".env.example";
  const REQUIRED_VARS = [
    "AUTH_SECRET",
    "AUTH_GOOGLE_ID",
    "AUTH_GOOGLE_SECRET",
    "AUTH_GITHUB_ID",
    "AUTH_GITHUB_SECRET",
    "MONGODB_URI",
  ];

  it(".env.example exists at the project root", () => {
    expect(fileExists(ENV_EXAMPLE)).toBe(true);
  });

  it.each(REQUIRED_VARS)(
    ".env.example declares %s with an empty value",
    (variable) => {
      const content = readFile(ENV_EXAMPLE);
      const match = content.match(new RegExp(`^${variable}=(.*)$`, "m"));
      expect(match, `${variable} not found in .env.example`).not.toBeNull();
      expect(match![1].trim()).toBe("");
    }
  );

  it(".env.example comment references Google Cloud Console", () => {
    const content = readFile(ENV_EXAMPLE);
    expect(content).toContain("console.cloud.google.com");
  });

  it(".env.example comment references GitHub developer settings", () => {
    const content = readFile(ENV_EXAMPLE);
    expect(content).toContain("github.com/settings/developers");
  });

  /**
   * NOTE: "git status shows .env.example as a tracked file" requires
   * a git command and depends on whether a commit has been made.
   * Automated proxy: .env.example is NOT listed in .gitignore.
   */
  it(".env.example is NOT effectively excluded by .gitignore", () => {
    const gitignore = readFile(".gitignore");
    const lines = gitignore
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#"));
    const explicitly_blocked = lines.some((l) => l === ".env.example");
    // .env* covers .env.example, so a negation rule must un-block it
    const has_broad_exclude = lines.some((l) => l === ".env*" || l === "*.env");
    const has_negation = lines.some((l) => l === "!.env.example");
    expect(explicitly_blocked).toBe(false);
    if (has_broad_exclude) {
      expect(
        has_negation,
        "'.env*' excludes .env.example — '!.env.example' negation is required"
      ).toBe(true);
    }
  });
});
