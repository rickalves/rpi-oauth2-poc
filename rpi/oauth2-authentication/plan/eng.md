# Engineering Specification — OAuth2 Authentication

**Feature**: OAuth2 Authentication with Google + GitHub  
**Stack**: Next.js 14+ App Router · TypeScript · Tailwind CSS · Auth.js v5 (`next-auth@beta`) · MongoDB (`@auth/mongodb-adapter`)  
**Decision**: GO — Confidence: HIGH (95%)  
**Date**: 2026-03-30

---

## 1. Technical Overview

This document specifies the complete implementation of social login (Google + GitHub) for a greenfield Next.js 14+ App Router project. Auth.js v5 handles the OAuth2 authorization code flow with PKCE, issues encrypted JWTs (AES-256-GCM), and persists user identity in MongoDB via the official adapter. No email/password, MFA, or RBAC is in scope for v1.

The implementation spans 13 files across four concerns: infrastructure (MongoDB singleton, Auth.js core config), Next.js wiring (route handler, middleware, layout), UI (login page, dashboard, header, landing page), and type safety (TypeScript extensions, environment). Middleware enforces route protection at the edge before any React rendering occurs.

---

## 2. Architecture Diagram

```
Browser                Next.js Edge          Auth.js Core           MongoDB Atlas
  │                       │                      │                       │
  │── GET /login ─────────▶                      │                       │
  │◀─ Login Page (HTML) ──│                      │                       │
  │                       │                      │                       │
  │── POST signIn("google")│                     │                       │
  │   (Client Action)     │── auth() ───────────▶│                       │
  │                       │                      │── Generate state/     │
  │                       │                      │   PKCE challenge      │
  │◀─ 302 → Google OAuth ─┤◀─ redirect URL ──────│                       │
  │                       │                      │                       │
  │──── Google OAuth consent + code ────────────▶│ (Google servers)      │
  │◀─── 302 → /api/auth/callback/google ─────────│                       │
  │                       │                      │                       │
  │── GET /api/auth/callback/google?code=... ────▶│                       │
  │                       │   route handler      │── Exchange code ──────▶ Google
  │                       │                      │◀─ access_token + id_token
  │                       │                      │                       │
  │                       │                      │── upsert user ───────▶│
  │                       │                      │── upsert account ────▶│
  │                       │                      │◀─ user._id ───────────│
  │                       │                      │                       │
  │                       │                      │── sign JWT (A256GCM)  │
  │◀─ 302 → /dashboard ───┤◀─ Set-Cookie: session│                       │
  │                       │                      │                       │
  │── GET /dashboard ─────▶ middleware            │                       │
  │                       │── auth() verify JWT ─▶│                       │
  │                       │◀─ session valid ──────│                       │
  │◀─ Dashboard (HTML) ───│                      │                       │
```

### Component Dependency Graph

```
layout.tsx
  └── SessionProvider (session-provider.tsx)
        └── {children}

page.tsx              (public, landing)
login/page.tsx        (public, triggers signIn)
dashboard/page.tsx    (protected, reads session)
  └── header.tsx      (auth-aware, calls signOut)

middleware.ts
  └── auth (from src/auth.ts)

src/auth.ts
  ├── GoogleProvider
  ├── GitHubProvider
  ├── MongoDBAdapter
  │     └── src/lib/mongodb.ts  (MongoClient singleton)
  └── callbacks.session / jwt

src/app/api/auth/[...nextauth]/route.ts
  └── { GET, POST } handlers from src/auth.ts

src/types/next-auth.d.ts  (augments Session + JWT types)
```

---

## 3. File Structure

```
src/
├── auth.ts                                  # Auth.js core config (providers, adapter, callbacks)
├── middleware.ts                            # Edge route protection, path matcher
├── types/
│   └── next-auth.d.ts                      # TypeScript module augmentation for Session/JWT
├── lib/
│   └── mongodb.ts                          # MongoClient singleton (dev global reuse)
├── app/
│   ├── layout.tsx                          # Root layout — wraps app with SessionProvider
│   ├── page.tsx                            # Landing page — login/dashboard links
│   ├── login/
│   │   └── page.tsx                        # Login page — Google/GitHub sign-in buttons
│   ├── dashboard/
│   │   └── page.tsx                        # Protected page — displays session.user data
│   └── api/
│       └── auth/
│           └── [...nextauth]/
│               └── route.ts               # Next.js route handler (GET + POST)
└── components/
    ├── header.tsx                          # Auth-aware header with user info + signOut
    └── providers/
        └── session-provider.tsx           # 'use client' SessionProvider wrapper

.env.local                                  # Secrets (git-ignored)
.env.example                               # Committed variable template
```

---

## 4. Component Specifications

### `src/lib/mongodb.ts`

**Purpose**: Exports a promise resolving to a single `MongoClient` instance. Prevents connection pool exhaustion during Next.js hot reload in development by caching the client on the Node.js `global` object.

**Key exports**: `default clientPromise: Promise<MongoClient>`

**Dependencies**: `mongodb`

**Implementation notes**:

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

Critical: `global._mongoClientPromise` prevents a new connection on every hot reload. In production the module is loaded once so the branch is skipped.

---

### `src/auth.ts`

**Purpose**: Single source of truth for Auth.js configuration — registers providers, attaches the MongoDB adapter, sets session strategy to JWT, and injects `userId` into the session object via callbacks.

**Key exports**: `auth`, `handlers`, `signIn`, `signOut`

**Dependencies**: `next-auth`, `next-auth/providers/google`, `next-auth/providers/github`, `@auth/mongodb-adapter`, `src/lib/mongodb`

**Implementation notes**:

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
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
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

- `session: { strategy: "jwt" }` is required with the MongoDB adapter to avoid persisting session documents in the database. Only `users` and `accounts` collections are written.
- The `jwt` callback runs first (on sign-in); the `session` callback shapes what the client receives.

---

### `src/app/api/auth/[...nextauth]/route.ts`

**Purpose**: Mounts Auth.js as a Next.js App Router route handler responding to all `/api/auth/*` paths (sign-in, callback, sign-out, CSRF token, session endpoint).

**Key exports**: `GET`, `POST` (named exports consumed by Next.js)

**Dependencies**: `src/auth`

```typescript
import { handlers } from "@/auth";

export const { GET, POST } = handlers;
```

No additional logic lives here. All configuration is in `src/auth.ts`.

---

### `src/middleware.ts`

**Purpose**: Intercepts requests at the Edge before rendering. Rejects unauthenticated requests to protected routes by redirecting to `/login`.

**Key exports**: `default` (middleware function), `config` (matcher)

**Dependencies**: `src/auth`

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

- `auth` used as middleware is an Auth.js v5 pattern — it attaches `req.auth` (the session) before calling the handler.
- The matcher uses Next.js path patterns; add new protected routes to the array as the app grows.
- The middleware runs on the Edge runtime; avoid Node.js-only APIs inside it.

---

### `src/components/providers/session-provider.tsx`

**Purpose**: Wraps the Auth.js `SessionProvider` (which uses React Context) in a `'use client'` boundary so it can be imported from the Server Component `layout.tsx`.

**Key exports**: `default SessionProvider` (re-export wrapper)

**Dependencies**: `next-auth/react`

```tsx
"use client";

import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";

export default function Providers({ children }: { children: ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
```

This pattern is required because `SessionProvider` uses `useContext` internally and must live in a Client Component.

---

### `src/app/layout.tsx`

**Purpose**: Root layout. Wraps the application in `SessionProvider` so any Client Component can call `useSession()`.

**Key exports**: `default RootLayout`, `metadata`

**Dependencies**: `src/components/providers/session-provider`, Tailwind globals

```tsx
import type { Metadata } from "next";
import Providers from "@/components/providers/session-provider";
import "./globals.css";

export const metadata: Metadata = { title: "RPI OAuth2 Demo" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

---

### `src/app/login/page.tsx`

**Purpose**: Public page presenting sign-in options. Calls `signIn()` from Auth.js with the provider id as argument.

**Key exports**: `default LoginPage`

**Dependencies**: `next-auth/react` (`signIn`), Tailwind

```tsx
"use client";

import { signIn } from "next-auth/react";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-bold">Sign in</h1>
      <button onClick={() => signIn("google", { callbackUrl: "/dashboard" })}>
        Sign in with Google
      </button>
      <button onClick={() => signIn("github", { callbackUrl: "/dashboard" })}>
        Sign in with GitHub
      </button>
    </main>
  );
}
```

`callbackUrl` is the post-sign-in redirect target. Auth.js validates it against the host to prevent open-redirect attacks.

---

### `src/components/header.tsx`

**Purpose**: Shared auth-aware header. Displays the user's name and avatar when authenticated; shows a sign-in link otherwise. Provides a sign-out button.

**Key exports**: `default Header`

**Dependencies**: `next-auth/react` (`useSession`, `signOut`), Next.js `Image`, Tailwind

```tsx
"use client";

import { useSession, signOut } from "next-auth/react";
import Image from "next/image";

export default function Header() {
  const { data: session } = useSession();

  return (
    <header className="flex items-center justify-between p-4 border-b">
      <span className="font-bold">RPI Demo</span>
      {session?.user ? (
        <div className="flex items-center gap-3">
          {session.user.image && (
            <Image
              src={session.user.image}
              alt="avatar"
              width={32}
              height={32}
              className="rounded-full"
            />
          )}
          <span>{session.user.name}</span>
          <button onClick={() => signOut({ callbackUrl: "/" })}>Sign out</button>
        </div>
      ) : (
        <a href="/login">Sign in</a>
      )}
    </header>
  );
}
```

---

### `src/app/dashboard/page.tsx`

**Purpose**: Protected example page. Auth enforced by middleware — this component can assume a valid session exists. Reads session server-side via `auth()`.

**Key exports**: `default DashboardPage`

**Dependencies**: `src/auth` (`auth`), Tailwind

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
        <pre className="bg-gray-100 p-4 rounded text-sm">
          {JSON.stringify(session?.user, null, 2)}
        </pre>
      </main>
    </>
  );
}
```

`auth()` is the server-side session accessor in Auth.js v5 — equivalent to `getServerSession()` in v4 but without passing config.

---

### `src/app/page.tsx`

**Purpose**: Public landing page. Links to login or dashboard depending on context.

**Key exports**: `default HomePage`

**Dependencies**: Next.js `Link`, Tailwind

```tsx
import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6">
      <h1 className="text-3xl font-bold">RPI OAuth2 Demo</h1>
      <div className="flex gap-4">
        <Link href="/login" className="px-4 py-2 bg-blue-600 text-white rounded">
          Sign In
        </Link>
        <Link href="/dashboard" className="px-4 py-2 border rounded">
          Dashboard
        </Link>
      </div>
    </main>
  );
}
```

---

### `src/types/next-auth.d.ts`

**Purpose**: Extends Auth.js's default TypeScript types to include `id` on `Session.user` and `userId` on `JWT`. Without this file, TypeScript will not recognise those properties.

**Key exports**: Module augmentation (no runtime exports)

**Dependencies**: `next-auth`

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

---

### `.env.local` / `.env.example`

**Purpose**: `.env.local` holds secrets for the local environment (git-ignored). `.env.example` is a committed template with placeholder values to document required variables.

See [Section 7 — Environment Variables](#7-environment-variables) for the full table.

---

## 5. Data Model

The `@auth/mongodb-adapter` auto-creates and manages four collections in the configured database. No manual schema definition is required.

### `users`

Stores one document per unique identity (one per email address, regardless of which provider was used first).

| Field | Type | Notes |
|---|---|---|
| `_id` | `ObjectId` | MongoDB auto-generated |
| `name` | `string` | From provider profile |
| `email` | `string` | Unique; used for account linking |
| `emailVerified` | `Date \| null` | Set if email was verified |
| `image` | `string` | Provider avatar URL |

### `accounts`

Stores one document per provider connection. A single `user` can have multiple accounts (Google + GitHub linked to same email).

| Field | Type | Notes |
|---|---|---|
| `_id` | `ObjectId` | Auto-generated |
| `userId` | `ObjectId` | FK → `users._id` |
| `type` | `string` | `"oauth"` |
| `provider` | `string` | `"google"` or `"github"` |
| `providerAccountId` | `string` | Provider's user ID |
| `access_token` | `string` | OAuth access token |
| `refresh_token` | `string \| null` | |
| `expires_at` | `number \| null` | Unix timestamp |
| `token_type` | `string` | `"Bearer"` |
| `scope` | `string` | Granted scopes |
| `id_token` | `string \| null` | OIDC id_token (Google) |

### `sessions`

> **Not used with JWT strategy.** If `session.strategy` is changed to `"database"`, the adapter will write session documents here. Left for reference.

| Field | Type | Notes |
|---|---|---|
| `_id` | `ObjectId` | |
| `sessionToken` | `string` | Unique token |
| `userId` | `ObjectId` | FK → `users._id` |
| `expires` | `Date` | Session expiry |

### `verification_tokens`

Used for email magic-link flows. Not active in v1 (no email provider), but the collection may be created by the adapter on first run.

| Field | Type | Notes |
|---|---|---|
| `identifier` | `string` | Email address |
| `token` | `string` | Hashed verification token |
| `expires` | `Date` | Token expiry |

---

## 6. Auth Flow

### Sign-In Flow (OAuth2 Authorization Code + PKCE)

```
1. User clicks "Sign in with Google" on /login
   └── signIn("google", { callbackUrl: "/dashboard" }) is called

2. Auth.js generates:
   - state parameter (CSRF prevention)
   - PKCE code_verifier + code_challenge (S256)
   - Stores both in a temporary HTTP-only cookie

3. Browser is redirected to Google's authorization endpoint:
   https://accounts.google.com/o/oauth2/v2/auth
     ?client_id=...
     &redirect_uri=https://yourdomain.com/api/auth/callback/google
     &response_type=code
     &scope=openid email profile
     &state=<csrf_token>
     &code_challenge=<pkce_challenge>
     &code_challenge_method=S256

4. User authenticates with Google and grants consent.

5. Google redirects browser to:
   /api/auth/callback/google?code=<auth_code>&state=<csrf_token>

6. Next.js routes the request to route.ts → Auth.js handler.
   Auth.js:
   a. Validates the state parameter against the cookie (CSRF check)
   b. Exchanges the auth code for tokens using the code_verifier (PKCE)
      POST https://oauth2.googleapis.com/token { code, code_verifier, ... }
   c. Receives: access_token, id_token, token_type, expires_in
   d. Decodes and verifies the id_token (OIDC)
   e. Extracts user profile: { id, name, email, image }

7. MongoDB adapter performs upsert operations:
   a. Find or create user in `users` by email
   b. Find or create account in `accounts` by (provider, providerAccountId)

8. Callbacks execute in order:
   a. jwt({ token, user }) — appends userId to the JWT token
   b. session({ session, token }) — appends userId to session.user

9. Auth.js signs and encrypts the JWT (AES-256-GCM, A256GCM)
   and issues it as an HTTP-only cookie named `__Secure-next-auth.session-token`
   (or `next-auth.session-token` in development).

10. Browser is redirected to callbackUrl (/dashboard).
    The session cookie is sent with all subsequent requests.
```

### Session Verification Flow (subsequent requests)

```
1. Browser requests GET /dashboard (cookie included automatically)

2. Next.js middleware intercepts at the Edge:
   auth(req) → Auth.js decrypts and verifies the JWT from the cookie
   req.auth = { user: { id, name, email, image }, expires }

3. If req.auth is null → redirect to /login
   If req.auth is valid → request proceeds to the Server Component

4. DashboardPage calls auth() server-side to access session data.
```

### Sign-Out Flow

```
1. User clicks "Sign out" → signOut({ callbackUrl: "/" })

2. Auth.js deletes the session cookie (sets Max-Age=0).
   With JWT strategy, no server-side state is invalidated
   (the JWT becomes unreadable once the cookie is gone).

3. Browser is redirected to "/".
```

---

## 7. Environment Variables

| Variable | Purpose | How to Obtain | Example |
|---|---|---|---|
| `NEXTAUTH_URL` | Canonical URL of the app; used for OAuth redirects | Set to your deployment URL | `http://localhost:3000` |
| `NEXTAUTH_SECRET` | Signing/encryption key for JWTs and cookies | `openssl rand -base64 32` | `K3y+...` (32 random bytes, base64) |
| `GOOGLE_CLIENT_ID` | OAuth 2.0 client ID for Google provider | [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials | `1234567890-abc.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | OAuth 2.0 client secret for Google provider | Same credential in Google Cloud Console | `GOCSPX-...` |
| `GITHUB_CLIENT_ID` | OAuth App client ID for GitHub provider | GitHub → Settings → Developer Settings → OAuth Apps | `Ov23liABCDEF123456` |
| `GITHUB_CLIENT_SECRET` | OAuth App client secret for GitHub provider | Same OAuth App in GitHub Settings | `abc123def456...` (40 hex chars) |
| `MONGODB_URI` | MongoDB connection string | MongoDB Atlas → Connect → Drivers | `mongodb+srv://user:pass@cluster.mongodb.net/rpi-oauth2` |

`.env.example` (committed to git):

```bash
# Auth.js
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=                    # openssl rand -base64 32

# Google OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# GitHub OAuth
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=

# MongoDB
MONGODB_URI=                        # mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/<dbname>
```

**Google OAuth setup**: Set Authorized Redirect URI to `http://localhost:3000/api/auth/callback/google` (development) and `https://yourdomain.com/api/auth/callback/google` (production).

**GitHub OAuth setup**: Set Authorization callback URL to `http://localhost:3000/api/auth/callback/github`.

---

## 8. Security Implementation

| Control | Mechanism | Implementation Detail |
|---|---|---|
| CSRF Protection | State parameter + signed cookie | Auth.js v5 generates a cryptographically random `state` value, stores it in an HTTP-only cookie, and validates it on callback. Automatic — no code required. |
| PKCE | `code_challenge` / `code_verifier` (S256) | Auth.js generates a PKCE pair for every authorization request. Prevents authorization code interception attacks. Automatic for OAuth2 providers. |
| JWT Encryption | AES-256-GCM (A256GCM) via `jose` | Session JWTs are encrypted (JWE), not just signed. The `NEXTAUTH_SECRET` is the encryption key. Without the secret, the token cannot be read. |
| Secure Cookies | `HttpOnly`, `SameSite=Lax`, `Secure` | Cookies are HTTP-only (no JS access), preventing XSS-based session theft. `Secure` flag enforced in production. Auth.js sets these automatically. |
| Secret Management | `.env.local` + `.gitignore` | All credentials stored as environment variables. `.env.local` excluded from version control. `.env.example` provides a safe template. |
| `callbackUrl` Validation | Host allowlist | Auth.js validates that `callbackUrl` shares the same host as the application, preventing open-redirect attacks. |
| Account Linking | Email-based matching via adapter | If a user signs in with GitHub using the same email as an existing Google account, the `@auth/mongodb-adapter` links both accounts to the same `users` document. |
| Dependency Pinning | `next-auth@beta` pinning | Pin the exact beta version in `package.json` to prevent unexpected breaking changes from beta updates. Review release notes on each upgrade. |

> **Note**: The JWT strategy (vs. database sessions) means session revocation is not possible without token expiry. This is an accepted trade-off for v1. Set a reasonable `maxAge` (default: 30 days) and document the limitation.

---

## 9. Implementation Order

Tasks are ordered to unblock dependencies as early as possible. Infrastructure must precede UI; type declarations should be in place before writing callbacks.

| Step | Task | Blocks | Rationale |
|---|---|---|---|
| 1 | Initialize Next.js project | Everything | Nothing else can start |
| 2 | Install `next-auth@beta`, `@auth/mongodb-adapter`, `mongodb` | Steps 5–8 | Packages must be available |
| 3 | Create `.env.local` + `.env.example` | Steps 5, 6 | Auth.js reads env vars at startup (throws if missing) |
| 4 | Register Google + GitHub OAuth apps; get credentials | Step 3 | Credentials needed in `.env.local` |
| 5 | Create `src/lib/mongodb.ts` | Step 6 | `auth.ts` imports `clientPromise` |
| 6 | Create `src/auth.ts` | Steps 7, 8 | Route handler and middleware both import from `auth.ts` |
| 7 | Create `src/app/api/auth/[...nextauth]/route.ts` | No dependents | Needed for OAuth callbacks to work |
| 8 | Create `src/middleware.ts` | No dependents | Independent; can be verified via curl/browser |
| 9 | Create `src/types/next-auth.d.ts` | Steps 11–14 | Type errors in callbacks and pages resolved early |
| 10 | Create `src/components/providers/session-provider.tsx` | Step 11 | Layout imports it |
| 11 | Update `src/app/layout.tsx` | Steps 12–14 | SessionProvider must wrap the tree before client hooks work |
| 12 | Create `src/app/login/page.tsx` | Manual test of sign-in | Sign-in buttons needed to trigger the flow |
| 13 | Create `src/components/header.tsx` | Steps 13, 14 | Shared across pages |
| 14 | Create `src/app/dashboard/page.tsx` | Manual test of protection | Validates middleware + session read |
| 15 | Create `src/app/page.tsx` | No dependents | Landing page; low priority, not on critical path |
| 16 | Verify `.env.local` in `.gitignore` | Pre-commit | Final safety check before first commit |

---

## 10. Testing Checklist

Manual verification steps in priority order. No automated tests in v1.

### Environment & Startup

- [ ] `npm run dev` starts without errors
- [ ] No `Missing environment variable` errors in console
- [ ] `http://localhost:3000` loads the landing page

### OAuth Flow — Google

- [ ] Navigate to `/login` — both buttons render
- [ ] Click "Sign in with Google" — redirected to Google consent screen
- [ ] Complete Google sign-in — redirected to `/dashboard`
- [ ] Dashboard displays correct `name`, `email`, `image` from Google profile
- [ ] Session cookie `next-auth.session-token` is present in browser DevTools (Application → Cookies)
- [ ] Reload `/dashboard` — session persists without re-authenticating

### OAuth Flow — GitHub

- [ ] Click "Sign in with GitHub" from `/login`
- [ ] Complete GitHub sign-in — redirected to `/dashboard`
- [ ] Dashboard displays correct GitHub profile data

### Route Protection (Middleware)

- [ ] Open a private/incognito window (no session)
- [ ] Navigate directly to `/dashboard` — redirected to `/login`
- [ ] Sign in — redirected back to `/dashboard`
- [ ] Navigate to `/` and `/login` without a session — pages load normally (not redirected)

### Sign Out

- [ ] Click "Sign out" in the header — redirected to `/`
- [ ] After sign-out, navigate to `/dashboard` — redirected to `/login`
- [ ] `next-auth.session-token` cookie is absent after sign-out

### MongoDB Persistence

- [ ] After first sign-in, verify a document exists in the `users` collection
- [ ] Verify a document exists in the `accounts` collection with correct `provider` and `providerAccountId`
- [ ] Sign in twice with the same account — only one `users` document exists (upsert, not duplicate)
- [ ] Sign in with Google and then GitHub using the same email — one `users` document, two `accounts` documents

### Header & Session Data

- [ ] Unauthenticated state: header shows "Sign in" link
- [ ] Authenticated state: header shows user name, avatar, and "Sign out" button
- [ ] User avatar (`next/image`) loads without console errors (check `next.config.ts` for allowed image domains)

### TypeScript

- [ ] `npm run build` completes without TypeScript errors
- [ ] `session.user.id` resolves correctly (no `Property 'id' does not exist` error)

---

## 11. Known Constraints & Tech Debt

| Item | Severity | Category | Recommended Timeline |
|---|---|---|---|
| No automated tests (unit, integration, e2e) | **High** | Quality | v1.1 — add Playwright e2e for login flows and middleware protection |
| Auth.js v5 is in beta — potential breaking changes | **Medium** | Stability | Pin exact version now; review changelogs before each dependency update |
| JWT strategy has no server-side session revocation | **Medium** | Security | Acceptable for v1. If revocation is needed: switch to `"database"` strategy or implement a token denylist |
| Account linking is implicit (email-based) | **Medium** | UX/Security | A user signing in with GitHub who previously used Google with the same email will be silently linked. No UX feedback. Add explicit linking UI in v1.1. |
| No custom error page for auth failures | **Low** | UX | Auth.js shows a generic error page. Add `src/app/auth/error/page.tsx` in v1.1. |
| No return URL preservation | **Low** | UX | After redirect to `/login`, the original URL is lost. Implement `callbackUrl` from `searchParams` in v1.1. |
| No rate limiting on `/api/auth/*` | **Low** | Security | Add middleware-level rate limiting (e.g., `@upstash/ratelimit`) in v1.1 before public exposure. |
| MongoDB connection retry logic not configured | **Low** | Reliability | The default MongoClient retry behavior is adequate for Atlas. Add explicit `retryWrites=true&w=majority` to the connection string. |
| `next/image` requires allowed domains config | **Low** | Correctness | Google and GitHub avatar URLs must be added to `remotePatterns` in `next.config.ts` or `<img>` tags will throw at build time. |
| No RBAC or authorization layer | **Info** | Scope | Out of scope for v1 by design. Document as explicit future work if the project evolves. |
