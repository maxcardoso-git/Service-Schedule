---
phase: 05-frontend-foundation-auth
plan: "04"
subsystem: auth
tags: [zustand, react-router-dom, jwt, react, tanstack-query, sonner]

requires:
  - phase: 05-03
    provides: Vite 8 + React 19 + Tailwind v4 + shadcn/ui scaffold with path alias and API proxy
  - phase: 05-01
    provides: Backend JWT auth endpoints (/admin/auth/login) with role-based AdminUser

provides:
  - Zustand authStore with token/user state and localStorage persistence
  - initFromToken with JWT decode + expiry check on page load
  - apiFetch wrapper with /api prefix, Bearer header injection, 401 auto-logout
  - ApiError class with status and code fields
  - Login page with email/password form and error display
  - ProtectedRoute component with optional role guard
  - App.jsx wired with QueryClientProvider, createBrowserRouter, and Toaster

affects:
  - 05-05 (AppLayout and nav will wrap the ProtectedRoute outlet)
  - 05-06 (all data-fetching pages will use apiFetch)
  - all future plans that call apiFetch or read from useAuthStore

tech-stack:
  added: []
  patterns:
    - "useAuthStore.getState() for imperative access outside React (login/logout in event handlers and apiFetch)"
    - "AppInitializer component pattern: mount-only useEffect calling initFromToken inside QueryClientProvider"
    - "createBrowserRouter with ProtectedRoute as element-level wrapper using Outlet"

key-files:
  created:
    - frontend/src/stores/authStore.js
    - frontend/src/lib/api.js
    - frontend/src/pages/Login.jsx
    - frontend/src/components/ProtectedRoute.jsx
    - frontend/src/pages/NotFound.jsx
  modified:
    - frontend/src/App.jsx

key-decisions:
  - "apiFetch uses /api prefix internally — callers pass paths like /admin/auth/login without /api"
  - "JWT decoded with atob + JSON.parse (no external library) — sufficient for reading payload on client"
  - "initFromToken called in AppInitializer component (not bare useEffect in App) to avoid hook-outside-component issues with router"
  - "ProtectedRoute uses Outlet pattern — wraps child routes without knowing their shape"

patterns-established:
  - "apiFetch pattern: all API calls go through apiFetch, never raw fetch"
  - "useAuthStore.getState() for non-reactive (imperative) access, useAuthStore(selector) for reactive component reads"

duration: 2min
completed: 2026-03-14
---

# Phase 5 Plan 4: Login Page + Auth Store + API Client Summary

**Zustand auth store with JWT localStorage persistence, apiFetch wrapper with 401 auto-logout, Login page, ProtectedRoute guard, and createBrowserRouter wiring in App.jsx**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-14T13:44:55Z
- **Completed:** 2026-03-14T13:46:43Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Auth store manages JWT lifecycle: stores token in localStorage, decodes on page load, clears expired tokens
- apiFetch centralizes all API calls with automatic auth headers, /api prefix, and 401 → logout + redirect
- Login page submits credentials, shows error on failure, redirects on success, auto-redirects if already logged in
- ProtectedRoute blocks unauthenticated navigation and enforces optional role restrictions
- App.jsx bootstraps QueryClient, initializes auth from stored token on mount, sets up router and Toaster

## Task Commits

1. **Task 1: Auth store + API client** - `4165e32` (feat)
2. **Task 2: Login page + ProtectedRoute + router wiring** - `8a675ce` (feat)

## Files Created/Modified

- `frontend/src/stores/authStore.js` - Zustand store with token/user state, login/logout/initFromToken
- `frontend/src/lib/api.js` - apiFetch with Bearer token, /api prefix, ApiError class, 401 auto-redirect
- `frontend/src/pages/Login.jsx` - Email/password form, error display, loading state, auto-redirect if authed
- `frontend/src/components/ProtectedRoute.jsx` - Guards routes by token presence, optional roles array check
- `frontend/src/pages/NotFound.jsx` - 404 page with home link
- `frontend/src/App.jsx` - QueryClientProvider, AppInitializer (initFromToken on mount), createBrowserRouter, Toaster

## Decisions Made

- `apiFetch` prepends `/api` internally — callers never include `/api` in the path argument
- JWT payload decoded client-side with `atob + JSON.parse`, no external JWT library needed
- `initFromToken` runs inside an `AppInitializer` component (rendered as child of QueryClientProvider, above RouterProvider) to ensure Zustand store access is clean before routing
- `ProtectedRoute` uses the `Outlet` pattern for composability — wraps any group of child routes without coupling to specific page components

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Login → auth store → ProtectedRoute chain is fully wired and build-verified
- `apiFetch` ready for all data-fetching pages in plans 05-05 through 05-07
- Dashboard placeholder at `/` shows "Dashboard" text — ready for AppLayout wrapper in 05-05
- No blockers

---
*Phase: 05-frontend-foundation-auth*
*Completed: 2026-03-14*
