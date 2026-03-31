# IMPLEMENT.md — OAuth2 Authentication (Google + GitHub)

**Feature**: OAuth2 Authentication with Google + GitHub  
**Branch**: feature/phase-1  
**Date**: 2026-03-31  
**Status**: COMPLETE  
**Author**: RPI Implement Pipeline

---

## Summary

Implemented social login (Google + GitHub) on a greenfield Next.js 14+ App Router project using Auth.js v5 and MongoDB. Auth.js handles the full OAuth2 Authorization Code + PKCE flow, issues AES-256-GCM encrypted JWTs, and persists user identity via `@auth/mongodb-adapter`. Route protection is enforced at the Edge via middleware; all UI state is available client-side via `SessionProvider`.

---

## Phases Completed

| Phase                      | Status  | Tasks       |
| -------------------------- | ------- | ----------- |
| Phase 1: Project Setup     | ✅ PASS | Tasks 1–4   |
| Phase 2: Infrastructure    | ✅ PASS | Tasks 5–8   |
| Phase 3: UI Authentication | ✅ PASS | Tasks 9–14  |
| Phase 4: Security & Polish | ✅ PASS | Tasks 15–17 |

---

## Files Created / Modified

| #   | File                                            | Action   | Description                                                                               |
| --- | ----------------------------------------------- | -------- | ----------------------------------------------------------------------------------------- |
| 1   | `.env.example`                                  | Created  | Committed variable template for all 6 required env vars                                   |
| 2   | `src/lib/mongodb.ts`                            | Created  | MongoClient singleton with `global` reuse in dev                                          |
| 3   | `src/auth.ts`                                   | Created  | Central Auth.js v5 config — Google + GitHub providers, MongoDBAdapter, JWT strategy       |
| 4   | `src/app/api/auth/[...nextauth]/route.ts`       | Created  | Next.js route handler exporting `GET` and `POST` from Auth.js handlers                    |
| 5   | `src/proxy.ts`                                  | Renamed  | Edge proxy — protects `/dashboard/:path*`, redirects to `/login`                          |
| 6   | `src/types/next-auth.d.ts`                      | Created  | TypeScript module augmentation extending `Session.user` with `id` and `JWT` with `userId` |
| 7   | `src/components/providers/session-provider.tsx` | Created  | `"use client"` wrapper around Auth.js `SessionProvider`                                   |
| 8   | `src/app/layout.tsx`                            | Modified | Root layout — wraps children with `SessionProvider`                                       |
| 9   | `src/app/login/page.tsx`                        | Created  | Public login page with Google and GitHub sign-in buttons                                  |
| 10  | `src/components/header.tsx`                     | Created  | Auth-aware header with user avatar/name/sign-out                                          |
| 11  | `src/app/dashboard/page.tsx`                    | Created  | Protected Server Component dashboard displaying `session.user`                            |
| 12  | `src/app/page.tsx`                              | Modified | Landing page with Sign In and Dashboard CTAs                                              |
| 13  | `next.config.ts`                                | Modified | Added `images.remotePatterns` for Google and GitHub avatar CDNs                           |
| 14  | `package.json`                                  | Modified | Added `next-auth@beta`, `@auth/mongodb-adapter`, `mongodb`                                |

---

## Prerequisites Before Running

Complete these steps before `npm run dev`:

1. **Generate `AUTH_SECRET`**:

   ```bash
   npx auth secret
   ```

2. **Google OAuth2** — [console.cloud.google.com](https://console.cloud.google.com):
   - Create OAuth client ID (Web application)
   - Redirect URI: `http://localhost:3000/api/auth/callback/google`

3. **GitHub OAuth App** — [github.com/settings/developers](https://github.com/settings/developers):
   - Callback URL: `http://localhost:3000/api/auth/callback/github`

4. **MongoDB** — Atlas free tier at [cloud.mongodb.com](https://cloud.mongodb.com)

5. **Create `.env.local`** (copy from `.env.example` and fill in values):
   ```bash
   cp .env.example .env.local
   ```

---

## Verification Checklist

After configuring `.env.local` and running `npm run dev`:

- [ ] `http://localhost:3000` — landing page renders, header shows "Sign in"
- [ ] `http://localhost:3000/dashboard` — redirects to `/login` (unauthenticated)
- [ ] `http://localhost:3000/login` — two sign-in buttons render
- [ ] Sign in with Google → redirects to `accounts.google.com`
- [ ] Sign in with GitHub → redirects to `github.com/login/oauth/authorize`
- [ ] After sign-in → redirected to `/dashboard`, user name/avatar visible
- [ ] Dashboard shows `session.user` JSON including `id` field
- [ ] Sign out → session cleared, redirected to `/`
- [ ] `http://localhost:3000/api/auth/csrf` → returns `{ "csrfToken": "..." }`
- [ ] `npx tsc --noEmit` → zero errors

---

## Security Controls

| Control                  | Mechanism                                                  |
| ------------------------ | ---------------------------------------------------------- |
| CSRF                     | State parameter + signed HTTP-only cookie (Auth.js native) |
| PKCE                     | `code_challenge`/`code_verifier` S256 (Auth.js native)     |
| JWT Encryption           | AES-256-GCM via `jose` using `AUTH_SECRET`                 |
| Secure Cookies           | `HttpOnly`, `SameSite=Lax`, `Secure` (production)          |
| `callbackUrl` Validation | Auth.js host allowlist — no open-redirect                  |
| Secret Management        | `.env.local` excluded from VCS via `.gitignore`            |
