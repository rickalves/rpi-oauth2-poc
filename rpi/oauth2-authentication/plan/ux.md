# UX Design — OAuth2 Authentication

**Feature**: OAuth2 Authentication (Google + GitHub)
**Stack**: Next.js 14+ App Router · TypeScript · Tailwind CSS · Auth.js v5 · MongoDB
**Scope**: Social login only. No email/password, no MFA.
**Date**: 2026-03-30

---

## 1. UX Goals

| Priority | Goal | Rationale |
|---|---|---|
| 1 | **Minimal friction** | Reduce steps to zero-form login; one click per provider |
| 2 | **Speed** | OAuth redirect must feel instant; avoid loading jank |
| 3 | **Trust** | Use official provider brand colors and recognizable button patterns |
| 4 | **Clarity** | Every state (loading, error, authed) gives clear feedback |
| 5 | **Recovery** | Auth failures surface actionable messages, not raw errors |

---

## 2. User Personas

### Guest User
- Not authenticated; lands on home page or a protected route
- Wants to access the app quickly with minimum effort
- Familiar with "Sign in with Google/GitHub" patterns from other apps

### Authenticated User
- Has an active session; navigates freely within the app
- Expects their avatar and name to appear in the header
- Wants a reliable, one-click sign-out

### Returning User (Redirect Case)
- Previously bookmarked `/dashboard` or another protected route
- Arrives unauthenticated; expects to land back on their intended page after login

---

## 3. User Flows

### 3.1 Sign In Flow

**Entry point**: Landing page (`/`) CTA button, or `/login` page directly, or any redirect from a protected route.

```
[Guest] --> [Landing Page /] --> [Click "Get Started"] --> [Login Page /login]
                                                                    |
                                          +-------------------------+-------------------------+
                                          |                                                   |
                                  [Click "Sign in with Google"]                  [Click "Sign in with GitHub"]
                                          |                                                   |
                                  [Google Consent Screen]                       [GitHub Consent Screen]
                                          |                                                   |
                                  [Auth.js OAuth Callback]                      [Auth.js OAuth Callback]
                                          |                                                   |
                                          +-------------------------+-------------------------+
                                                                    |
                                                    [Session created / MongoDB upsert]
                                                                    |
                                                    [Redirect to /dashboard or callbackUrl]
                                                                    |
                                                            [Dashboard Page]
```

**Steps**:
1. Guest lands on `/` or is redirected from a protected route to `/login?callbackUrl=<original>`
2. Guest sees two buttons: "Sign in with Google" and "Sign in with GitHub"
3. Guest clicks a provider button
4. Login page shows a spinner/loading state on the clicked button; both buttons become disabled
5. Browser redirects to provider consent screen (Auth.js handles this)
6. User approves consent on the provider
7. Auth.js processes the OAuth callback at `/api/auth/callback/<provider>`
8. Session is created; user record is upserted in MongoDB
9. User is redirected to `/dashboard` (or `callbackUrl` if present)

**End state**: Authenticated session active; user sees Dashboard with their profile data.

**Error handling**:

| Scenario | Behavior |
|---|---|
| User denies consent on provider | Redirected to `/login?error=OAuthCallback`; error banner shown |
| Provider returns an error | Redirected to `/login?error=<code>`; generic "Authentication failed" message |
| Network timeout during redirect | Browser native timeout; user returns to `/login`; retry encouraged |
| Account already linked to another provider | Auth.js `OAuthAccountNotLinked` error → error banner with explanation |

---

### 3.2 Sign Out Flow

**Entry point**: Header component (authenticated state).

```
[Authenticated User] --> [Header: click "Sign out"] --> [Loading state on button]
                                                                |
                                                    [signOut() called (Auth.js)]
                                                                |
                                                    [Session destroyed]
                                                                |
                                                    [Redirect to / (Home)]
```

**Steps**:
1. Authenticated user clicks "Sign out" in the Header
2. Button shows loading state; click is non-repeatable
3. `signOut()` is called; session cookie is cleared
4. User is redirected to `/`

**End state**: No active session; user sees Landing page in unauthenticated state.

**Error handling**:

| Scenario | Behavior |
|---|---|
| `signOut()` call fails | Toast/banner: "Failed to sign out. Try again."; session state unchanged |

---

### 3.3 Protected Route Access (Unauthenticated)

**Entry point**: Any direct URL access to `/dashboard` or other protected routes (enforced by `src/middleware.ts`).

```
[Guest] --> [Navigates to /dashboard]
                    |
            [Middleware: no session]
                    |
            [Redirect to /login?callbackUrl=/dashboard]
                    |
            [User completes Sign In Flow 3.1]
                    |
            [Redirect back to /dashboard]
```

**Steps**:
1. User navigates to a protected route
2. Middleware detects no valid session
3. Middleware redirects to `/login?callbackUrl=<original-path>`
4. User completes the Sign In flow
5. After successful auth, user is redirected to `callbackUrl`

**End state**: User lands on their originally requested page, authenticated.

**Error handling**:

| Scenario | Behavior |
|---|---|
| `callbackUrl` is an external URL | Middleware sanitizes `callbackUrl`; falls back to `/dashboard` |
| Login fails mid-flow | Error shown on `/login`; `callbackUrl` param preserved |

---

### 3.4 Already-Authenticated Redirect

**Entry point**: Authenticated user navigates to `/login`.

```
[Authenticated User] --> [Navigates to /login]
                                  |
                        [Middleware: valid session]
                                  |
                        [Redirect to /dashboard]
```

**Steps**:
1. User with active session navigates to `/login`
2. Middleware detects valid session
3. User is immediately redirected to `/dashboard`

**End state**: User is on `/dashboard` without seeing the login page.

---

## 4. Screen Specifications

### 4.1 Landing Page (`/`)

**Purpose**: First impression; routes guests to login, routes authenticated users to dashboard.

**Key Elements**:

| Element | Behavior |
|---|---|
| Hero headline | Static text describing the product |
| "Get Started" CTA button | Links to `/login` (guest) or `/dashboard` (authenticated) |
| Header | Auth-aware (see Header component spec) |

**States**:

| State | Description |
|---|---|
| Default (guest) | Hero visible; CTA links to `/login` |
| Authenticated | CTA label changes to "Go to Dashboard"; links to `/dashboard` |

**Accessibility**:
- CTA button has descriptive `aria-label`: `"Get started with OAuth2 App"`
- Heading hierarchy: `<h1>` for hero headline

---

### 4.2 Login Page (`/login`)

**Purpose**: Sole authentication surface. No form fields — only social login buttons.

**Key Elements**:

| Element | Behavior |
|---|---|
| Page title | "Sign in to [App Name]" |
| Google sign-in button | Triggers `signIn("google")`; passes `callbackUrl` |
| GitHub sign-in button | Triggers `signIn("github")`; passes `callbackUrl` |
| Error banner | Conditionally rendered when `?error=` param is present |

**States**:

| State | Description |
|---|---|
| Default | Both provider buttons active and visible |
| Loading | Clicked button shows spinner, label changes to "Signing in…"; both buttons `disabled` |
| Error | Banner above buttons: "Authentication failed. Please try again." with specific hint for `OAuthAccountNotLinked` |

**Error Messages by Code**:

| `error` param value | User-facing message |
|---|---|
| `OAuthCallback` | "Authentication failed. Please try again." |
| `OAuthAccountNotLinked` | "This email is already linked to another sign-in method." |
| `AccessDenied` | "Access was denied. You can try again or use a different account." |
| _(any other)_ | "Something went wrong. Please try again." |

**Accessibility**:
- Buttons have `aria-label`: `"Sign in with Google"`, `"Sign in with GitHub"`
- Loading state sets `aria-busy="true"` on the button and `aria-disabled="true"` on the inactive button
- Error banner uses `role="alert"` and `aria-live="assertive"`
- Focus is programmatically set to error banner when it appears
- Keyboard: `Tab` moves between buttons; `Enter`/`Space` activates

---

### 4.3 Dashboard Page (`/dashboard`)

**Purpose**: Main authenticated view. Displays user identity data.

**Key Elements**:

| Element | Behavior |
|---|---|
| User avatar | Circular image from provider (`user.image`); fallback initials avatar |
| User name | `user.name` from session |
| User email | `user.email` from session |
| Header | Authenticated state (avatar + sign-out button) |
| Page content | Placeholder content / welcome message |

**States**:

| State | Description |
|---|---|
| Loading | Skeleton loaders for avatar, name, email while session resolves |
| Authenticated | Full profile displayed |
| Avatar load failure | Initials-based fallback avatar (`bg-gray-200`, first letter of name) |

**Accessibility**:
- Avatar `<img>` has `alt="<user.name>'s profile picture"`; fallback has `aria-label="<user.name> avatar"`
- Heading: `<h1>Welcome, <user.name>`
- Page `<title>` updates to `"Dashboard — [App Name]"`

---

### 4.4 Header Component

**Purpose**: Global navigation; renders differently based on auth state.

**States**:

| State | Elements |
|---|---|
| Unauthenticated | Logo + "Sign in" link (→ `/login`) |
| Authenticated | Logo + user avatar (small, circular) + user name + "Sign out" button |
| Loading (session resolving) | Logo + skeleton placeholder (prevents layout shift) |

**Key Element Behaviors**:

| Element | Behavior |
|---|---|
| "Sign in" link | Navigates to `/login` |
| Avatar | Non-interactive display; shows provider image or initials fallback |
| User name | Truncated with `truncate` at ~150px max-width on mobile |
| "Sign out" button | Calls `signOut()`; shows spinner during operation |

**Accessibility**:
- "Sign in" link: `aria-label="Sign in to your account"`
- "Sign out" button: `aria-label="Sign out of your account"`; `aria-busy="true"` during loading
- Avatar image: `alt="<user.name>"`
- Skip-to-main-content link as first focusable element in DOM

---

## 5. Component Breakdown

| Component | Location | Flows |
|---|---|---|
| `LandingPage` | `app/page.tsx` | 3.1 (entry), 3.4 (authed redirect) |
| `LoginPage` | `app/login/page.tsx` | 3.1 (Sign In), 3.3 (Protected entry), 3.4 (redirect out) |
| `ProviderButton` | `components/auth/ProviderButton.tsx` | 3.1 |
| `AuthErrorBanner` | `components/auth/AuthErrorBanner.tsx` | 3.1 (error state) |
| `DashboardPage` | `app/dashboard/page.tsx` | 3.1 (end state), 3.2 (entry), 3.3 (end state) |
| `UserProfile` | `components/dashboard/UserProfile.tsx` | 3.1, 3.3 |
| `Header` | `components/layout/Header.tsx` | 3.1, 3.2, 3.4 |
| `AvatarDisplay` | `components/ui/AvatarDisplay.tsx` | 3.1, 3.2, header |
| `Middleware` | `src/middleware.ts` | 3.3, 3.4 |

---

## 6. Interaction Patterns

### 6.1 OAuth Redirect Loading State

When a provider button is clicked:
1. Clicked button: label → "Signing in…"; spinner appears left of label
2. Other provider button: `opacity-50 cursor-not-allowed disabled`
3. Browser navigates away — no further client state needed

No skeleton screen needed for the redirect itself (navigation is full-page).

### 6.2 Post-Login Page Load

On first render of `/dashboard` after sign-in:
- Session may not be instantly available on client
- Show skeleton loaders for avatar (circle, `w-12 h-12`), name (rect, `w-32 h-4`), email (rect, `w-48 h-3`)
- Replace with real data once `useSession()` / server session resolves

### 6.3 Error Display on `/login`

- Error is detected from the `?error=` query param (set by Auth.js on callback failure)
- Banner rendered at the top of the card, above buttons
- Banner style: `bg-red-50 border border-red-300 text-red-800 rounded-md p-3`
- Includes a dismiss button (×) to hide the banner without clearing the URL

### 6.4 Sign-Out Redirect

- `signOut({ callbackUrl: "/" })` is called
- Header sign-out button shows spinner; `aria-busy="true"`
- Full-page redirect to `/` after session is destroyed
- No intermediate confirmation dialog (low-risk action with easy re-auth)

### 6.5 Redirect Preservation (`callbackUrl`)

- Middleware appends `?callbackUrl=<encoded-path>` when redirecting to `/login`
- `ProviderButton` reads `callbackUrl` from `useSearchParams()` and passes it to `signIn()`
- After successful auth, Auth.js redirects to `callbackUrl`
- Validation: `callbackUrl` must be a relative path (same origin); middleware rejects external URLs

---

## 7. Design Guidelines

### 7.1 Tailwind CSS Conventions

- **Spacing scale**: `p-4`, `gap-4`, `mt-6` — use multiples of 4 consistently
- **Rounded corners**: `rounded-lg` for cards, `rounded-full` for avatars and pill buttons
- **Shadows**: `shadow-sm` for cards, `shadow-md` for modals/overlays
- **Font weight**: `font-semibold` for button labels, `font-medium` for nav items, `font-normal` for body
- **Color usage**: Neutral grays for backgrounds (`bg-gray-50`, `bg-white`); brand colors only on provider buttons

### 7.2 Visual Hierarchy

```
Page Title (text-2xl font-bold)
  └── Section Heading (text-lg font-semibold)
        └── Body / Description (text-sm text-gray-600)
              └── Labels / Captions (text-xs text-gray-400)
```

### 7.3 Provider Button Styles

#### Google Button
```
bg-white border border-gray-300 hover:bg-gray-50
text-gray-700 font-medium text-sm
rounded-lg px-4 py-2.5
shadow-sm
```
- Google logo SVG (official) left of label
- Label: "Sign in with Google"
- Do **not** use `bg-[#4285F4]` unless following exact Google brand guidelines (white button is preferred and brand-compliant)

#### GitHub Button
```
bg-[#24292F] hover:bg-[#1a1f24]
text-white font-medium text-sm
rounded-lg px-4 py-2.5
```
- GitHub Invertocat SVG (white) left of label
- Label: "Sign in with GitHub"

#### Shared Button Layout
```
flex items-center justify-center gap-3 w-full
transition-colors duration-150
focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
```
- Full-width inside their container
- Vertically centered icon + label

### 7.4 Avatar Display

- Size in header: `w-8 h-8` (32px) — circular, `rounded-full`, `object-cover`
- Size on dashboard: `w-16 h-16` (64px) — circular, `rounded-full`
- Fallback initials avatar: `bg-gray-300 text-gray-700 font-semibold` — show first character of `user.name`
- Provider image loaded via `<Image>` (Next.js) with `sizes` and `priority` on dashboard

### 7.5 Loading / Skeleton States

- Skeleton base: `bg-gray-200 animate-pulse rounded`
- Avatar skeleton: `rounded-full w-16 h-16`
- Text skeleton widths: `w-32`, `w-48` — vary to avoid repetition

### 7.6 Contrast & Color Accessibility

| Element | Foreground | Background | Contrast |
|---|---|---|---|
| Body text | `text-gray-900` (#111827) | `bg-white` | ≥ 7:1 (AAA) |
| Secondary text | `text-gray-600` (#4B5563) | `bg-white` | ≥ 4.5:1 (AA) |
| Error text | `text-red-800` (#991B1B) | `bg-red-50` | ≥ 4.5:1 (AA) |
| GitHub button | `text-white` | `bg-[#24292F]` | ≥ 4.5:1 (AA) |
| Google button | `text-gray-700` | `bg-white` | ≥ 4.5:1 (AA) |

All interactive elements must meet WCAG 2.1 AA minimum contrast (4.5:1 for text, 3:1 for large text and UI components).

### 7.7 Responsive Breakpoints

| Breakpoint | Layout |
|---|---|
| Mobile (`< 640px`) | Single column; buttons full-width; header collapses name text |
| Tablet (`640px–1024px`) | Centered card on login page (`max-w-sm mx-auto`) |
| Desktop (`> 1024px`) | Same as tablet; dashboard may expand to multi-column |

Login card constraint: `w-full max-w-sm` — centered with `mx-auto`, `p-8` internal padding, `rounded-2xl shadow-md bg-white`.
