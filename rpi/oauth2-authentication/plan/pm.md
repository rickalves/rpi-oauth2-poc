# PM — OAuth2 Authentication (Google + GitHub)

**Feature ID**: oauth2-authentication
**Priority**: P0
**Status**: Approved — GO (Confidence: 95%)
**Date**: 2026-03-30

---

## 1. Overview

This feature introduces social login to the platform via Google and GitHub OAuth2 providers, powered by Auth.js v5 on a Next.js 14+ App Router stack with MongoDB as the persistence layer. It is the foundational identity layer of the application — every user-specific capability (dashboards, saved state, personalisation) is blocked on this delivery. The scope is intentionally narrow: social login only, JWT-based sessions, and middleware-enforced route protection. No email/password flow, no MFA, and no role-based access control are included in this release.

---

## 2. Why Now

All planned user-specific features are gated on a verified identity system. Without authenticated sessions there is no way to associate data, protect routes, or personalise the product experience. This is the single highest-leverage unblocked item on the roadmap.

---

## 3. Users & Jobs to Be Done

| User Type               | Job to Be Done                                                                                                           |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **Guest**               | Authenticate quickly using an account I already trust (Google or GitHub), without creating a new password                |
| **Authenticated User**  | Access protected product areas, see my own identity reflected in the UI, and sign out cleanly when done                  |
| **Product/Engineering** | Reliably persist user identity across sessions and providers; gate access to protected routes without bespoke middleware |

---

## 4. User Stories

### Guest

**US-01** — As a guest, I want to sign in with my Google account so that I can access the platform without creating a new password.

**US-02** — As a guest, I want to sign in with my GitHub account so that I can access the platform using my developer identity.

**US-03** — As a guest, I want to be redirected to the login page when I attempt to access a protected route so that I understand I need to authenticate first.

### Authenticated User

**US-04** — As an authenticated user, I want my name and avatar to appear in the header so that I can confirm I am signed in as the correct account.

**US-05** — As an authenticated user, I want to sign out so that my session is destroyed and I am returned to a public state.

**US-06** — As an authenticated user, I want my account information (name, email, provider, profile image) to be persisted so that the platform can recognise me across return visits.

**US-07** — As an authenticated user, I want my session to remain valid across page navigations and refreshes so that I do not have to re-authenticate during normal use.

---

## 5. Acceptance Criteria

### US-01 — Sign in with Google

- **Given** I am on the `/login` page
- **When** I click "Sign in with Google"
- **Then** I am redirected to Google's OAuth2 consent screen
- **And** on successful authorisation I am redirected back and land on the authenticated application
- **And** a session cookie is set (HTTP-only, SameSite, Secure)
- **And** my user record (name, email, image, provider `google`) is created or updated in MongoDB

### US-02 — Sign in with GitHub

- **Given** I am on the `/login` page
- **When** I click "Sign in with GitHub"
- **Then** I am redirected to GitHub's OAuth2 authorisation page
- **And** on successful authorisation I am redirected back and land on the authenticated application
- **And** a session cookie is set (HTTP-only, SameSite, Secure)
- **And** my user record (name, email, image, provider `github`) is created or updated in MongoDB

### US-03 — Access control redirect

- **Given** I am not authenticated
- **When** I navigate to any route matching `/dashboard/*`
- **Then** I am redirected to `/login`
- **And** my original destination URL is not preserved in v1 (post-launch backlog)

### US-04 — Auth-aware header

- **Given** I am authenticated
- **When** I view any page that includes the header component
- **Then** my display name and avatar image are rendered in the header
- **And** a visible "Sign out" control is present
- **Given** I am not authenticated
- **When** I view any page that includes the header component
- **Then** a "Sign in" link or button is rendered instead

### US-05 — Sign out

- **Given** I am authenticated
- **When** I trigger the sign-out action (button or link)
- **Then** the session cookie is destroyed server-side
- **And** I am redirected to a public page (e.g., `/`)
- **And** protected routes are no longer accessible without re-authenticating

### US-06 — User persistence

- **Given** I complete a successful OAuth2 flow (Google or GitHub)
- **Then** a document is written (or upserted) to the MongoDB `users` collection containing: `name`, `email`, `image`, `provider`, `providerAccountId`, `createdAt`
- **And** subsequent logins update `updatedAt` without creating duplicate user documents for the same email+provider pair

### US-07 — Session continuity

- **Given** I am authenticated and I navigate between pages or refresh the browser
- **Then** my session state is preserved without re-authentication
- **And** the JWT is validated on each request via Auth.js middleware
- **And** the session expires according to the configured maxAge (default Auth.js v5 behaviour)

---

## 6. Functional Requirements

| #     | Requirement                                                                 | Acceptance Criteria Reference |
| ----- | --------------------------------------------------------------------------- | ----------------------------- |
| FR-01 | OAuth2 authentication via Google provider                                   | US-01                         |
| FR-02 | OAuth2 authentication via GitHub provider                                   | US-02                         |
| FR-03 | JWT-based stateless sessions                                                | US-07                         |
| FR-04 | MongoDB persistence via `@auth/mongodb-adapter` (users, accounts, sessions) | US-06                         |
| FR-05 | Middleware-based route protection for `/dashboard/*`                        | US-03                         |
| FR-06 | Login page with branded Google and GitHub sign-in buttons                   | US-01, US-02                  |
| FR-07 | Logout with session destruction and redirect                                | US-05                         |
| FR-08 | Auth-aware header component (name, avatar, sign-out)                        | US-04                         |
| FR-09 | Route handler at `/api/auth/[...nextauth]`                                  | US-01, US-02, US-05           |
| FR-10 | Session provider wrapping the app for client-side session access            | US-04, US-07                  |

---

## 7. Non-Functional Requirements

| Category               | Requirement                                                                                         |
| ---------------------- | --------------------------------------------------------------------------------------------------- |
| **Security — CSRF**    | Built-in CSRF protection via Auth.js v5 (double-submit cookie pattern)                              |
| **Security — Cookies** | Session cookies must have `HttpOnly`, `SameSite=Lax`, `Secure` flags set by default                 |
| **Security — PKCE**    | PKCE enforced on all OAuth2 flows via Auth.js v5 default                                            |
| **Security — JWT**     | AES-256-GCM encryption for JWT payload via Auth.js v5                                               |
| **Security — Secrets** | All secrets stored in `.env.local`; `.env.example` template committed; no secrets in source control |
| **Type Safety**        | Full TypeScript coverage; `Session` and `JWT` types extended for custom claims                      |
| **Performance**        | Login redirect round-trip < 3 s on a standard connection (provider-dependent)                       |
| **Observability**      | Auth.js debug mode disabled in production; errors logged via platform logger                        |
| **Availability**       | Feature inherits platform SLO; no additional SLO defined for v1                                     |
| **Privacy**            | Only name, email, and avatar image collected from provider; no additional OAuth scopes requested    |

---

## 8. Out of Scope

The following are explicitly **not** included in this release:

- Email/password (credentials) authentication
- Magic link / passwordless email login
- Multi-factor authentication (MFA / TOTP)
- Role-based access control (RBAC)
- Organisation or team management
- Account linking across providers (same email, different provider — handled by adapter but not surfaced in UI)
- Return URL preservation after login redirect
- Custom error pages for auth failures
- Rate limiting on auth endpoints
- Automated tests for login flows, middleware, session validation, logout
- Additional OAuth providers (e.g., Twitter/X, Microsoft, Apple)

---

## 9. Dependencies & Prerequisites

| Dependency                              | Owner          | Notes                                                                                                   |
| --------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------- |
| Google OAuth2 Client ID + Secret        | Platform/Infra | Must be created in Google Cloud Console; authorised redirect URI: `{BASE_URL}/api/auth/callback/google` |
| GitHub OAuth App Client ID + Secret     | Platform/Infra | Must be created in GitHub Developer Settings; callback URL: `{BASE_URL}/api/auth/callback/github`       |
| MongoDB instance (Atlas or self-hosted) | Platform/Infra | Connection string required; database and collection names configurable                                  |
| `AUTH_SECRET` (32-byte random string)   | Platform/Infra | Used for JWT signing/encryption; must be rotated if compromised                                         |
| Node.js 18+                             | Engineering    | Required by Next.js 14+                                                                                 |
| `next-auth@beta` (Auth.js v5)           | Engineering    | Must pin version to avoid breaking beta changes                                                         |
| `@auth/mongodb-adapter`                 | Engineering    | Peer dependency on `mongodb` driver                                                                     |

---

## 10. Risks & Mitigations

| #    | Risk                                                                                                                                                                      | Likelihood | Impact   | Mitigation                                                                                                                                                       |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R-01 | **Account collision**: A user signs in with Google and later with GitHub using the same email address — the adapter may create two separate user records or fail silently | Medium     | Medium   | Document known behaviour of `@auth/mongodb-adapter` for this edge case; add a manual merge note in the post-launch backlog; do not surface account linking in v1 |
| R-02 | **No automated test coverage at launch**: Regressions in login flow, session handling, or route protection may not be caught before they reach users                      | High       | High     | Flag as P0 post-launch item; include manual smoke-test checklist in the release runbook; schedule test sprint immediately after v1 ships                         |
| R-03 | **`next-auth@beta` instability**: Breaking changes in a beta package could require emergency patches                                                                      | Low        | High     | Pin exact version in `package.json`; review Auth.js changelog before any dependency update                                                                       |
| R-04 | **Misconfigured OAuth redirect URIs**: Wrong callback URLs in provider settings cause 100% auth failure                                                                   | Low        | Critical | Include redirect URI configuration in deployment checklist; validate in staging before production deploy                                                         |
| R-05 | **MongoDB connection failure**: Auth adapter cannot persist user records, causing login errors                                                                            | Low        | High     | Ensure connection string includes retry logic; add MongoDB health check to observability stack                                                                   |

---

## 11. Rollout Plan

| Phase                       | Description                                                                                                                                       |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Local dev**               | Engineers configure `.env.local` from `.env.example`; validate Google + GitHub flows locally                                                      |
| **Staging**                 | Deploy to staging environment with production-equivalent OAuth credentials and MongoDB instance; execute manual smoke tests                       |
| **Production**              | Feature flag not required (no existing authenticated users to protect); deploy directly; monitor error logs and session creation metrics for 24 h |
| **Post-launch (sprint +1)** | Implement automated tests; add custom error page; evaluate rate limiting                                                                          |

---

## 12. Success Metrics

### Leading Indicators (detectable immediately post-launch)

| Metric                                   | Target                                                                  |
| ---------------------------------------- | ----------------------------------------------------------------------- |
| Successful OAuth2 callback rate (Google) | ≥ 99% of initiated flows complete without error                         |
| Successful OAuth2 callback rate (GitHub) | ≥ 99% of initiated flows complete without error                         |
| User document creation rate in MongoDB   | 100% of successful logins produce a valid user record                   |
| Middleware redirect accuracy             | 100% of unauthenticated requests to `/dashboard/*` redirect to `/login` |
| Session cookie present post-login        | 100% of successful logins result in a valid session cookie              |

### Lagging Indicators (measurable after user adoption)

| Metric                                 | Target                                                                          |
| -------------------------------------- | ------------------------------------------------------------------------------- |
| Auth error rate in production logs     | < 1% of all auth attempts                                                       |
| Session expiry-related support tickets | 0 in first 30 days                                                              |
| Duplicate user records in MongoDB      | 0 for same-provider logins; documented and tracked for cross-provider edge case |

---

## 13. Open Questions

| #     | Question                                                                                                                           | Owner   | Due                                               |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------- | ------- | ------------------------------------------------- |
| OQ-01 | What should happen when a user attempts to link the same email via a second provider? Accept and silently merge, block, or prompt? | Product | Pre-launch (documents expected adapter behaviour) |
| OQ-02 | What is the desired session `maxAge`? Auth.js v5 default is 30 days.                                                               | Product | Before staging deploy                             |
| OQ-03 | Is there a preferred redirect destination after successful login? (e.g., `/dashboard`)                                             | Product | Before staging deploy                             |
