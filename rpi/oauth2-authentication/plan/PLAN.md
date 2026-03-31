# PLAN.md — OAuth2 Authentication (Google + GitHub)

**Feature**: OAuth2 Authentication with Google + GitHub  
**Date**: 2026-03-30  
**Status**: GO — Confidence: HIGH (95%)  
**Effort Estimate**: 3–5 hours (senior developer)  
**Author**: RPI Plan Pipeline

---

## TL;DR

This plan implements social login (Google + GitHub) on a greenfield Next.js 14+ App Router project using Auth.js v5 and MongoDB. Auth.js handles the full OAuth2 Authorization Code + PKCE flow, issues AES-256-GCM encrypted JWTs, and persists user identity via `@auth/mongodb-adapter`. Route protection is enforced at the Edge by a single proxy file; all UI state is available client-side via `SessionProvider`. The implementation spans 13 files across 4 phases and requires no custom OAuth logic.

---

## Supporting Documents

| Document         | Description                                                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| [pm.md](pm.md)   | Product requirements, user stories (US-01–US-07), acceptance criteria, functional & non-functional requirements                 |
| [ux.md](ux.md)   | User flows (sign-in, sign-out, protected route, already-authenticated redirect), screen specs, interaction patterns             |
| [eng.md](eng.md) | Technical architecture, component specifications with full code snippets, data model, auth flow sequence, environment variables |

---

## Prerequisites & Setup

All of the following must be in place **before writing a single line of code**:

### 1. Node.js 18+

```bash
node --version   # must be >= 18.0.0
```

Download from [nodejs.org](https://nodejs.org) if needed.

### 2. Google OAuth2 Credentials

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a project (or select an existing one)
3. Navigate to **APIs & Services → Credentials → Create Credentials → OAuth client ID**
4. Application type: **Web application**
5. Add Authorized Redirect URI:
   - Development: `http://localhost:3000/api/auth/callback/google`
   - Production: `https://yourdomain.com/api/auth/callback/google`
6. Save the **Client ID** and **Client Secret**

### 3. GitHub OAuth App

1. Go to [github.com/settings/developers](https://github.com/settings/developers)
2. Click **New OAuth App**
3. Set the Authorization callback URL:
   - Development: `http://localhost:3000/api/auth/callback/github`
   - Production: `https://yourdomain.com/api/auth/callback/github`
4. Save the **Client ID** and **Client Secret**

### 4. MongoDB Instance

- **Atlas (recommended)**: [cloud.mongodb.com](https://cloud.mongodb.com) — free M0 tier is sufficient
- **Local**: MongoDB Community Server running on `mongodb://localhost:27017`
- Have the full connection string ready: `mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/<dbname>`

### 5. AUTH_SECRET

Generate a secure 32-byte secret:

```bash
npx auth secret
# or
openssl rand -base64 32
```

---

## Implementation Phases

---

### Phase 1: Project Setup

**Goal**: Scaffold the Next.js application and install all dependencies. No authentication code yet — just a clean slate with the right configuration.  
**Estimated effort**: 30–45 min  
**Status**: ✅ COMPLETE — 2026-03-31

| Check                             | Result                       |
| --------------------------------- | ---------------------------- |
| Unit tests (`npm test`)           | ✅ 24/24 passed              |
| Lint (`npx eslint src/ tests/`)   | ✅ 0 errors, 0 warnings      |
| Format (`npm run format:check`)   | ✅ All files formatted       |
| TypeScript (`npm run type-check`) | ✅ 0 errors                  |
| Test file                         | `tests/phase1/setup.test.ts` |

---

#### Task 1 — Initialize Next.js Project

**Files affected**: scaffolded by `create-next-app` (entire `src/` tree, `package.json`, `tsconfig.json`, `tailwind.config.ts`, `.eslintrc.json`, `next.config.ts`, `.gitignore`)

**Command**:

```bash
npx create-next-app@latest . --typescript --tailwind --app --eslint --src-dir
```

When prompted, accept all defaults. The `--src-dir` flag places all application code under `src/`, which is assumed throughout this plan.

**Key implementation notes**:

- Use `.` (current directory) as the target — do not create a subdirectory
- The `--app` flag selects the App Router; do **not** select Pages Router
- The scaffolded `src/app/layout.tsx` and `src/app/page.tsx` will be **replaced** in Phase 3

**Acceptance check**:

- [ ] `npm run dev` starts without errors on `http://localhost:3000` _(manual — start server and verify in browser)_
- [x] `src/app/layout.tsx` exists with the App Router root layout structure ✅ `setup.test.ts`
- [x] `tsconfig.json` includes `"paths": { "@/*": ["./src/*"] }` (required for `@/` imports) ✅ `setup.test.ts`

---

#### Task 2 — Install Authentication Dependencies

**Files affected**: `package.json`, `package-lock.json`

**Command**:

```bash
npm install next-auth@beta @auth/mongodb-adapter mongodb
```

**Key implementation notes**:

- `next-auth@beta` is Auth.js v5 — the App Router-native version. Do **not** install `next-auth@latest` (v4); v4 does not support App Router natively
- Pin the exact installed version in `package.json` after install (check `package-lock.json`) to avoid regressions from beta updates: `"next-auth": "5.0.0-beta.X"`
- `@auth/mongodb-adapter` and `mongodb` are both required; the adapter does not bundle the driver

**Acceptance check**:

- [x] `node_modules/next-auth` exists ✅ `setup.test.ts`
- [x] `node_modules/@auth/mongodb-adapter` exists ✅ `setup.test.ts`
- [x] `node_modules/mongodb` exists ✅ `setup.test.ts`
- [ ] `npm run build` produces no missing-module errors _(manual — requires `.env.local` with real credentials)_

---

#### Task 3 — Configure Environment Variables

**Files affected**: `.env.local` (created, git-ignored)

**Create `.env.local`**:

```bash
AUTH_SECRET=<output of `npx auth secret`>
AUTH_GOOGLE_ID=<Google client ID>
AUTH_GOOGLE_SECRET=<Google client secret>
AUTH_GITHUB_ID=<GitHub client ID>
AUTH_GITHUB_SECRET=<GitHub client secret>
MONGODB_URI=<MongoDB connection string>
```

**Key implementation notes**:

- `AUTH_SECRET` is used by Auth.js v5 for JWT signing/encryption (AES-256-GCM). Minimum 32 bytes of entropy; never reuse between environments
- Auth.js v5 reads `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` automatically when you use the `Google()` provider without explicit `clientId`/`clientSecret` props — but the `eng.md` spec uses explicit props for clarity; both approaches work
- `MONGODB_URI` must include the database name: `mongodb+srv://user:pass@cluster.mongodb.net/mydb`
- Confirm `.gitignore` includes `.env.local` (Next.js scaffolding does this by default — verify in Task 17)

**Acceptance check**:

- [ ] `.env.local` exists at the project root _(manual — copy `.env.example` and fill in real credentials)_
- [ ] All 6 variables are populated with real values _(manual — requires OAuth app and MongoDB credentials)_
- [x] `git status` does **not** show `.env.local` as a tracked file ✅ `.env*` + `!.env.example` in `.gitignore` · `setup.test.ts`

---

#### Task 4 — Create `.env.example`

**Files affected**: `.env.example` (new, committed to source control)

**Content**:

```bash
# Auth.js v5 — required for JWT signing/encryption
# Generate with: npx auth secret
AUTH_SECRET=

# Google OAuth2 — https://console.cloud.google.com/
# Redirect URI: http://localhost:3000/api/auth/callback/google
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=

# GitHub OAuth App — https://github.com/settings/developers
# Callback URL: http://localhost:3000/api/auth/callback/github
AUTH_GITHUB_ID=
AUTH_GITHUB_SECRET=

# MongoDB connection string (include database name)
# Example: mongodb+srv://user:pass@cluster.mongodb.net/mydb
MONGODB_URI=
```

**Key implementation notes**:

- All values must be **empty** — this file documents required variables without exposing secrets
- Include comments that tell the engineer exactly where to obtain each value
- This file **is** committed to source control

**Acceptance check**:

- [x] `.env.example` exists at the project root with all 6 variables and empty values ✅ `setup.test.ts`
- [x] Comments point to the correct external resources ✅ `setup.test.ts`
- [x] `git status` shows `.env.example` as a tracked (not ignored) file ✅ `!.env.example` negation added to `.gitignore` · `setup.test.ts`

---

### Phase 2: Infrastructure

**Goal**: Wire up the MongoDB connection, Auth.js core configuration, the Next.js route handler, and the Edge proxy. No UI changes in this phase — the app is not yet navigable.  
**Estimated effort**: 45–60 min

---

#### Task 5 — Create MongoDB Singleton (`src/lib/mongodb.ts`)

**Files affected**: `src/lib/mongodb.ts` (new)

**Key implementation notes**:

```typescript
import { MongoClient } from "mongodb";

if (!process.env.MONGODB_URI) {
  throw new Error('Missing environment variable: "MONGODB_URI"');
}

const uri = process.env.MONGODB_URI;
const options = {};

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

if (process.env.NODE_ENV === "development") {
  if (!global._mongoClientPromise) {
    client = new MongoClient(uri, options);
    global._mongoClientPromise = client.connect();
  }
  clientPromise = global._mongoClientPromise;
} else {
  client = new MongoClient(uri, options);
  clientPromise = client.connect();
}

export default clientPromise;
```

- The `global._mongoClientPromise` trick prevents connection pool exhaustion during Next.js hot reload in development. In production the module is loaded once and the `else` branch runs directly
- The `declare global` block is required to avoid TypeScript errors on `global._mongoClientPromise`
- The `throw` on missing URI fails fast at startup rather than at the first auth operation

**Acceptance check**:

- [ ] File compiles without TypeScript errors (`npx tsc --noEmit`)
- [ ] Importing the file in a test script and awaiting the promise connects to MongoDB without error

---

#### Task 6 — Configure Auth.js (`src/auth.ts`)

**Files affected**: `src/auth.ts` (new)

**Key implementation notes**:

```typescript
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
import { MongoDBAdapter } from "@auth/mongodb-adapter";
import clientPromise from "@/lib/mongodb";

export const { auth, handlers, signIn, signOut } = NextAuth({
  adapter: MongoDBAdapter(clientPromise),
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
    }),
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID!,
      clientSecret: process.env.AUTH_GITHUB_SECRET!,
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.userId = user.id;
      return token;
    },
    async session({ session, token }) {
      if (token.userId) session.user.id = token.userId as string;
      return session;
    },
  },
});
```

- `session: { strategy: "jwt" }` is **required** with the MongoDB adapter. Without it Auth.js defaults to `"database"` strategy and writes a session document on every request. JWT keeps sessions stateless
- The `jwt` callback runs first (on sign-in and token refresh) and stores `user.id` from the database document. The `session` callback runs second and exposes it to the client
- Destructure all four exports (`auth`, `handlers`, `signIn`, `signOut`) — each is consumed by a different file in later tasks
- `AUTH_SECRET` is read automatically by Auth.js v5 from the environment — do not pass it explicitly

**Acceptance check**:

- [ ] File compiles without TypeScript errors
- [ ] No TypeScript error on `session.user.id` assignment (requires Task 16 to fully resolve; can stub for now)

---

#### Task 7 — Create Route Handler (`src/app/api/auth/[...nextauth]/route.ts`)

**Files affected**: `src/app/api/auth/[...nextauth]/route.ts` (new)

**Key implementation notes**:

```typescript
import { handlers } from "@/auth";

export const { GET, POST } = handlers;
```

That is the complete file. Do not add any logic here — all configuration lives in `src/auth.ts`. The `[...nextauth]` catch-all segment matches all `/api/auth/*` paths: `/api/auth/signin`, `/api/auth/callback/google`, `/api/auth/callback/github`, `/api/auth/signout`, `/api/auth/session`, `/api/auth/csrf`.

**Acceptance check**:

- [ ] `GET http://localhost:3000/api/auth/providers` returns a JSON object listing `google` and `github` providers
- [ ] `GET http://localhost:3000/api/auth/csrf` returns a CSRF token JSON object

---

#### Task 8 — Create Proxy (`src/proxy.ts`)

**Files affected**: `src/proxy.ts` (new)

**Key implementation notes**:

```typescript
import { auth } from "@/auth";

export default auth((req) => {
  if (!req.auth) {
    const loginUrl = new URL("/login", req.url);
    return Response.redirect(loginUrl);
  }
});

export const config = {
  matcher: ["/dashboard/:path*"],
};
```

- `auth` used as middleware is an Auth.js v5 pattern — it decrypts and validates the session JWT and attaches it to `req.auth` before invoking the handler function
- The handler function only runs for matched routes. For `/dashboard/:path*`, any unauthenticated request redirects to `/login`
- **Do not** add `callbackUrl` to the redirect in v1 — return URL preservation is in the post-launch backlog
- The proxy runs on the **Edge runtime**. Do not import any Node.js-only APIs (fs, crypto, etc.) inside it. The `@/auth` import is safe because Auth.js v5 is Edge-compatible
- To protect additional routes in the future, add paths to the `matcher` array

**Acceptance check**:

- [ ] `GET http://localhost:3000/dashboard` (unauthenticated) returns a 302 redirect to `/login`
- [ ] File compiles without TypeScript errors
- [ ] `npm run build` passes (proxy is type-checked separately)

---

### Phase 3: UI Authentication

**Goal**: Build all user-facing UI — the login page, protected dashboard, auth-aware header, landing page, and the session wiring that makes `useSession()` available throughout the app.  
**Estimated effort**: 60–90 min

---

#### Task 9 — Create SessionProvider Wrapper (`src/components/providers/session-provider.tsx`)

**Files affected**: `src/components/providers/session-provider.tsx` (new)

**Key implementation notes**:

```tsx
"use client";

import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";

export default function Providers({ children }: { children: ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
```

This wrapper is required because `SessionProvider` from `next-auth/react` uses React Context (`useContext`) internally and therefore **must** be a Client Component. The root `layout.tsx` is a Server Component and cannot use Client Components directly without this boundary.

**Acceptance check**:

- [ ] File has `"use client"` as its first line
- [ ] File compiles without TypeScript errors
- [ ] No warnings about using Context in a Server Component

---

#### Task 10 — Update Root Layout (`src/app/layout.tsx`)

**Files affected**: `src/app/layout.tsx` (modify — replace scaffolded content)

**Key implementation notes**:

```tsx
import type { Metadata } from "next";
import Providers from "@/components/providers/session-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "RPI OAuth2 Demo",
  description: "OAuth2 authentication with Google and GitHub",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

- `Providers` wraps `children` at the root so every page in the app can call `useSession()` without needing its own provider
- The `globals.css` import preserves Tailwind's base styles from the scaffold
- Remove any `next/font` imports from the scaffolded layout if present — they are not needed for this POC

**Acceptance check**:

- [ ] `useSession()` called in any Client Component descendant does not throw "SessionProvider not found"
- [ ] Page renders without console errors related to SessionProvider

---

#### Task 11 — Create Login Page (`src/app/login/page.tsx`)

**Files affected**: `src/app/login/page.tsx` (new)

**Key implementation notes**:

```tsx
"use client";

import { signIn } from "next-auth/react";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6">
      <h1 className="text-2xl font-bold">Sign in</h1>
      <p className="text-gray-500">Choose a provider to continue</p>
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <button
          onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
          className="flex items-center justify-center gap-2 rounded-md border px-4 py-2 hover:bg-gray-50"
        >
          Sign in with Google
        </button>
        <button
          onClick={() => signIn("github", { callbackUrl: "/dashboard" })}
          className="flex items-center justify-center gap-2 rounded-md border px-4 py-2 hover:bg-gray-50"
        >
          Sign in with GitHub
        </button>
      </div>
    </main>
  );
}
```

- `"use client"` is required because `signIn` from `next-auth/react` uses browser APIs
- `callbackUrl: "/dashboard"` tells Auth.js where to redirect after a successful login. Auth.js validates `callbackUrl` against the current host to prevent open-redirect attacks
- Do **not** use `signIn("google")` without a `callbackUrl` — the default redirect is `/` which will show the landing page rather than the authenticated area
- The provider string (`"google"`, `"github"`) must exactly match the provider ID registered in `src/auth.ts`

**Acceptance check**:

- [ ] `GET http://localhost:3000/login` renders the page with two buttons
- [ ] Clicking "Sign in with Google" redirects to `accounts.google.com`
- [ ] Clicking "Sign in with GitHub" redirects to `github.com/login/oauth/authorize`

---

#### Task 12 — Create Auth-Aware Header (`src/components/header.tsx`)

**Files affected**: `src/components/header.tsx` (new)

**Key implementation notes**:

```tsx
"use client";

import { useSession, signOut } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";

export default function Header() {
  const { data: session } = useSession();

  return (
    <header className="flex items-center justify-between px-6 py-4 border-b">
      <Link href="/" className="font-bold text-lg">
        RPI Demo
      </Link>
      {session?.user ? (
        <div className="flex items-center gap-3">
          {session.user.image && (
            <Image
              src={session.user.image}
              alt={session.user.name ?? "User avatar"}
              width={32}
              height={32}
              className="rounded-full"
            />
          )}
          <span className="text-sm">{session.user.name}</span>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="text-sm text-gray-500 hover:text-gray-900"
          >
            Sign out
          </button>
        </div>
      ) : (
        <Link href="/login" className="text-sm">
          Sign in
        </Link>
      )}
    </header>
  );
}
```

- `useSession()` returns the session from the nearest `SessionProvider` context. This is why Task 10 (wrapping the layout) must be done first
- `session?.user.image` is an external URL (provider CDN). Next.js `Image` requires the hostname to be in `next.config.ts` under `images.remotePatterns`. Add at minimum `lh3.googleusercontent.com` (Google) and `avatars.githubusercontent.com` (GitHub)
- `signOut({ callbackUrl: "/" })` destroys the server-side session cookie and redirects to `/`

**Acceptance check**:

- [ ] Authenticated: displays user avatar, name, and "Sign out" button
- [ ] Unauthenticated: displays "Sign in" link
- [ ] Clicking "Sign out" clears the session and redirects to `/`

---

#### Task 13 — Create Dashboard Page (`src/app/dashboard/page.tsx`)

**Files affected**: `src/app/dashboard/page.tsx` (new)

**Key implementation notes**:

```tsx
import { auth } from "@/auth";
import Header from "@/components/header";

export default async function DashboardPage() {
  const session = await auth();

  return (
    <>
      <Header />
      <main className="p-8">
        <h1 className="text-2xl font-bold mb-4">Dashboard</h1>
        <p className="text-gray-500 mb-4">Welcome, {session?.user?.name}.</p>
        <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
          {JSON.stringify(session?.user, null, 2)}
        </pre>
      </main>
    </>
  );
}
```

- This is a **Server Component** (no `"use client"`). `auth()` is the Auth.js v5 server-side session accessor — equivalent to `getServerSession()` in v4 but without passing the config object
- The proxy (Task 8) guarantees that any request reaching this component has a valid session. It is safe to display `session?.user` without a null-guard redirect here, though the null coalescing is kept for TypeScript safety
- Do **not** call `getServerSession()` (v4 API) here — use `auth()` (v5 API)

**Acceptance check**:

- [ ] Authenticated user sees their name, email, and avatar URL in the JSON block
- [ ] `session.user.id` is present in the JSON output (confirms the `jwt` + `session` callbacks in Task 6 are working)
- [ ] Unauthenticated access to `/dashboard` redirects to `/login` (confirmed via proxy, not this component)

---

#### Task 14 — Create Landing Page (`src/app/page.tsx`)

**Files affected**: `src/app/page.tsx` (modify — replace scaffolded content)

**Key implementation notes**:

```tsx
import Link from "next/link";
import Header from "@/components/header";

export default function HomePage() {
  return (
    <>
      <Header />
      <main className="flex min-h-[calc(100vh-65px)] flex-col items-center justify-center gap-6">
        <h1 className="text-3xl font-bold">RPI OAuth2 Demo</h1>
        <p className="text-gray-500 max-w-md text-center">
          A demonstration of OAuth2 authentication with Google and GitHub using
          Auth.js v5 and MongoDB.
        </p>
        <div className="flex gap-4">
          <Link
            href="/login"
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Sign In
          </Link>
          <Link
            href="/dashboard"
            className="px-4 py-2 border rounded-md hover:bg-gray-50"
          >
            Dashboard
          </Link>
        </div>
      </main>
    </>
  );
}
```

- This is a **Server Component** (no `"use client"`)
- "Dashboard" link works as a secondary CTA — if the user is not authenticated, proxy redirects them to `/login` automatically
- The `Header` component is included here so the authenticated state is visible on the landing page

**Acceptance check**:

- [ ] `GET http://localhost:3000` renders the landing page with both CTAs
- [ ] Header shows unauthenticated state for guest, authenticated state for signed-in user

---

### Phase 4: Security & Polish

**Goal**: Ensure TypeScript types are correct, CSRF protection is verified, and sensitive files are excluded from source control.  
**Estimated effort**: 20–30 min

---

#### Task 15 — Verify CSRF Protection

**Files affected**: none (documentation and verification only)

**Key implementation notes**:

Auth.js v5 provides CSRF protection natively via the **double-submit cookie pattern**:

1. A CSRF token is generated server-side and stored in an HTTP-only cookie
2. The same token is embedded in sign-in form submissions
3. Auth.js validates that the cookie value matches the submitted value before processing any sign-in or sign-out action
4. The token endpoint is available at `GET /api/auth/csrf` and returns `{ csrfToken: "..." }`

No additional code is required. Verify the mechanism is active by inspecting the response from `GET /api/auth/csrf` and confirming the `next-auth.csrf-token` cookie is set.

**Acceptance check**:

- [ ] `GET http://localhost:3000/api/auth/csrf` returns `{ "csrfToken": "<hex string>" }`
- [ ] `next-auth.csrf-token` cookie is present in browser DevTools after visiting any Auth.js endpoint
- [ ] A POST to `/api/auth/signin/google` without the CSRF token returns a 400 error (Auth.js rejects it)

---

#### Task 16 — Add TypeScript Type Extensions (`src/types/next-auth.d.ts`)

**Files affected**: `src/types/next-auth.d.ts` (new)

**Key implementation notes**:

```typescript
import type { DefaultSession, DefaultJWT } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    userId?: string;
  }
}
```

- Without this file, TypeScript will error on `session.user.id` in `src/auth.ts` (Task 6) and `src/app/dashboard/page.tsx` (Task 13) because `id` is not in Auth.js's default `Session.user` type
- The `& DefaultSession["user"]` intersection preserves the built-in fields (`name`, `email`, `image`)
- The `JWT` augmentation adds `userId?` (optional because it is only present after the first sign-in triggers the `jwt` callback)
- `tsconfig.json` must include `"typeRoots": ["./src/types", "./node_modules/@types"]` or include the file via `"include"` — verify the scaffold's `tsconfig.json` covers `src/**/*`

**Acceptance check**:

- [ ] `npx tsc --noEmit` passes with zero errors
- [ ] `session.user.id` is accessible without type assertion in `src/app/dashboard/page.tsx`
- [ ] `token.userId` is accessible without type assertion in the `jwt` callback in `src/auth.ts`

---

#### Task 17 — Verify `.gitignore`

**Files affected**: `.gitignore` (verify; add entry if missing)

**Key implementation notes**:

The `create-next-app` scaffold generates a `.gitignore` that already includes `.env.local`. Verify this is the case:

```bash
grep -n ".env.local" .gitignore
```

If the line is missing, add it:

```bash
echo "\n# local env file\n.env.local" >> .gitignore
```

Also confirm the following entries are present (all should be in the scaffold-generated file):

- `.env*.local`
- `node_modules/`
- `.next/`

**Acceptance check**:

- [ ] `git status` does not list `.env.local` as a tracked or untracked file to be committed
- [ ] `git check-ignore -v .env.local` confirms the file is ignored
- [ ] `.env.example` **is** tracked by git (confirm with `git status --short .env.example`)

---

## File Manifest

| #   | File Path                                       | Type   | Description                                                                                                |
| --- | ----------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------- |
| 1   | `.env.local`                                    | New    | Runtime secrets — AUTH_SECRET, provider credentials, MONGODB_URI (git-ignored)                             |
| 2   | `.env.example`                                  | New    | Committed template documenting all required environment variables with empty values                        |
| 3   | `src/lib/mongodb.ts`                            | New    | MongoClient singleton with `global` reuse in dev to prevent hot-reload connection exhaustion               |
| 4   | `src/auth.ts`                                   | New    | Central Auth.js v5 config — Google + GitHub providers, MongoDBAdapter, JWT strategy, session/jwt callbacks |
| 5   | `src/app/api/auth/[...nextauth]/route.ts`       | New    | Next.js App Router handler exporting `GET` and `POST` from Auth.js `handlers`                              |
| 6   | `src/proxy.ts`                                  | New    | Edge proxy using `auth` to protect `/dashboard/:path*`; redirects unauthenticated requests to `/login`     |
| 7   | `src/components/providers/session-provider.tsx` | New    | `"use client"` wrapper around Auth.js `SessionProvider` enabling use in Server Component layout            |
| 8   | `src/app/layout.tsx`                            | Modify | Root layout — wraps `children` with `SessionProvider` so `useSession()` is available app-wide              |
| 9   | `src/app/login/page.tsx`                        | New    | Public login page with "Sign in with Google" and "Sign in with GitHub" buttons                             |
| 10  | `src/components/header.tsx`                     | New    | Auth-aware header — shows user name/avatar + sign-out when authenticated, sign-in link when not            |
| 11  | `src/app/dashboard/page.tsx`                    | New    | Protected Server Component dashboard displaying `session.user` data (name, email, image, id)               |
| 12  | `src/app/page.tsx`                              | Modify | Landing page hero with CTAs linking to `/login` and `/dashboard`                                           |
| 13  | `src/types/next-auth.d.ts`                      | New    | TypeScript module augmentation extending `Session.user` with `id` and `JWT` with `userId`                  |

---

## Dependencies Graph

The critical path runs: **1 → 2 → 3 → 5 → 6 → 7/8 → 9/10/11/12/13 → 14 → 16**

```
Task 1 (scaffold)
  └── Task 2 (install deps)
        ├── Task 3 (env vars)
        │     └── Task 4 (.env.example)
        ├── Task 5 (mongodb.ts)
        │     └── Task 6 (auth.ts)
        │           ├── Task 7 (route handler)        ← unblocks OAuth callbacks
        │           ├── Task 8 (proxy)                ← unblocks route protection
        │           └── Task 16 (types) ──────────────← unblocks TS errors in Task 6
        └── [Task 6 resolved]
              ├── Task 9 (session-provider.tsx)
              │     └── Task 10 (layout.tsx)          ← unblocks useSession() everywhere
              │           ├── Task 11 (login page)
              │           ├── Task 12 (header.tsx)
              │           ├── Task 13 (dashboard)
              │           └── Task 14 (page.tsx)
              └── Task 15 (CSRF — verify only, no blocking deps)
Task 17 (.gitignore) — independent, can be done at any point
```

**Key blocking relationships**:

| Blocker | Blocked By                      | Reason                                                                                   |
| ------- | ------------------------------- | ---------------------------------------------------------------------------------------- |
| Task 1  | All tasks                       | Cannot install, configure, or write code without the scaffolded project                  |
| Task 2  | Tasks 5, 6, 7, 8, 9, 11, 12, 13 | All auth imports require the installed packages                                          |
| Task 5  | Task 6                          | `src/auth.ts` imports `clientPromise` from `src/lib/mongodb.ts`                          |
| Task 6  | Tasks 7, 8, 13, 15, 16          | Route handler, proxy, dashboard, and CSRF check all depend on exports from `src/auth.ts` |
| Task 9  | Task 10                         | Layout imports `Providers` from `session-provider.tsx`                                   |
| Task 10 | Tasks 11, 12, 13, 14            | All UI components that call `useSession()` require the provider to be in the tree        |

---

## Manual Verification Checklist

Run these steps in order after completing all 17 tasks. Each step has an expected result; any deviation indicates a bug.

### Environment

```bash
npm run dev   # must start without errors on http://localhost:3000
```

---

### Step 1 — Landing Page (unauthenticated)

1. Open `http://localhost:3000` in an incognito/private browser window
2. **Expected**: Landing page renders with "Sign In" and "Dashboard" CTAs
3. **Expected**: Header shows "Sign in" link (not a user name/avatar)
4. **Expected**: No console errors

---

### Step 2 — Protected Route Redirect

1. In the same incognito window, navigate directly to `http://localhost:3000/dashboard`
2. **Expected**: Immediately redirected to `http://localhost:3000/login`
3. **Expected**: No flash of the dashboard content before redirect (proxy fires at Edge)

---

### Step 3 — Login Page

1. Navigate to `http://localhost:3000/login`
2. **Expected**: Page renders with two buttons: "Sign in with Google" and "Sign in with GitHub"
3. **Expected**: No console errors, no missing session provider warnings

---

### Step 4 — Google OAuth2 Flow

1. Click "Sign in with Google"
2. **Expected**: Browser redirects to `accounts.google.com`
3. Complete the Google consent flow with a test account
4. **Expected**: Browser redirected back to `http://localhost:3000/dashboard`
5. **Expected**: Dashboard displays the authenticated user's name, email, and image URL in JSON
6. **Expected**: `session.user.id` is a non-null string in the JSON output
7. **Expected**: Header shows the user's name, avatar, and "Sign out" button

---

### Step 5 — Session Persistence

1. While authenticated, refresh the browser (`F5`)
2. **Expected**: Still authenticated — dashboard still shows user data
3. Open a new tab to `http://localhost:3000`
4. **Expected**: Header shows authenticated state with user name/avatar

---

### Step 6 — Sign Out

1. Click "Sign out" in the header
2. **Expected**: Redirected to `http://localhost:3000/`
3. **Expected**: Header shows "Sign in" link (session cleared)
4. Navigate to `http://localhost:3000/dashboard`
5. **Expected**: Redirected to `/login` (session is gone, proxy fires)

---

### Step 7 — GitHub OAuth2 Flow

1. Navigate to `http://localhost:3000/login`
2. Click "Sign in with GitHub"
3. **Expected**: Browser redirects to `github.com/login/oauth/authorize`
4. Complete the GitHub authorization flow with a test account
5. **Expected**: Browser redirected to `http://localhost:3000/dashboard`
6. **Expected**: Dashboard shows GitHub user's name, email, and avatar URL

---

### Step 8 — MongoDB Persistence

1. Open your MongoDB client (Atlas UI, Compass, or `mongosh`)
2. Navigate to the database specified in `MONGODB_URI`
3. **Expected**: `users` collection contains at least one document with `name`, `email`, `image`, `emailVerified`
4. **Expected**: `accounts` collection contains at least one document with `provider: "google"` or `provider: "github"`, `userId` referencing the user document
5. **Expected**: `sessions` collection is empty (JWT strategy — no session documents)
6. Sign in again with the same provider
7. **Expected**: No new duplicate user document in `users` for the same email + provider combination

---

### Step 9 — CSRF Verification

1. In a browser tab, navigate to `http://localhost:3000/api/auth/csrf`
2. **Expected**: Response is `{ "csrfToken": "<hex string>" }`
3. Open browser DevTools → Application → Cookies
4. **Expected**: A cookie named `next-auth.csrf-token` (development) or `__Host-next-auth.csrf-token` (production) is present

---

### Step 10 — Build Verification

```bash
npm run build
```

**Expected**: Build completes with zero errors. Zero TypeScript errors. Zero ESLint errors (warnings acceptable).

---

## Post-Launch Backlog

| Priority | Item                                    | Notes                                                                                                                                                                                   |
| -------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **P0**   | Automated test coverage                 | Login flows, proxy protection, session validation, logout. No automated tests ship with v1; regressions are caught only by manual checklist. Schedule immediately after v1 ships        |
| **P0**   | Return URL preservation (`callbackUrl`) | Currently the proxy does not append `callbackUrl` to the `/login` redirect, so direct-URL access loses the intended destination after sign-in                                           |
| **P1**   | Custom error page for auth failures     | Auth.js errors (OAuthCallback, OAuthAccountNotLinked, etc.) currently redirect to the default Auth.js error page. A custom `/auth/error` page matching the app's design should be added |
| **P1**   | Rate limiting on auth endpoints         | `/api/auth/*` endpoints have no rate limiting in v1. Add per-IP rate limiting at the edge (e.g., via Vercel middleware or an upstream CDN rule) before production traffic               |
| **P1**   | MongoDB connection retry logic          | `src/lib/mongodb.ts` has no retry or connection health check. For production, add `serverSelectionTimeoutMS`, `connectTimeoutMS`, and a health endpoint                                 |
| **P2**   | Account linking across providers        | A user who signs in with Google and later with GitHub using the same email address may encounter an `OAuthAccountNotLinked` error. Design and implement a provider-linking UX           |
| **P2**   | Session `maxAge` configuration          | Currently uses Auth.js v5 default (30 days). Align with product decision on session duration before production deploy                                                                   |
| **P2**   | Additional OAuth providers              | Twitter/X, Microsoft, Apple, or other providers can be added to `src/auth.ts` with minimal effort once the core infrastructure is in place                                              |
