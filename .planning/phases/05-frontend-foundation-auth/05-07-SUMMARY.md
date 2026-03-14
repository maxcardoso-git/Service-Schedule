---
phase: 05-frontend-foundation-auth
plan: 07
subsystem: infra
tags: [express, vite, react, spa, static-serving, production]

# Dependency graph
requires:
  - phase: 05-frontend-foundation-auth
    provides: all prior plans (01-06) — React app built, bundled via Vite
provides:
  - Express static file serving for production single-process deployment
  - SPA fallback: client-side routes return index.html without /api interference
  - frontend/dist production build
affects: [phase 6 (scheduling), phase 7 (receptionist), phase 8 (integrations), VPS deployment]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Express static + SPA fallback pattern: API routes first, then express.static(dist), then GET * fallback with /api guard, then errorHandler last"
    - "ESM __dirname: path.dirname(fileURLToPath(import.meta.url)) for CommonJS-equivalent path resolution in ESM modules"

key-files:
  created:
    - frontend/dist/index.html (build artifact, not committed)
    - frontend/dist/assets/index-*.js (bundle)
    - frontend/dist/assets/index-*.css (styles)
  modified:
    - src/app.js — added path/fileURLToPath imports and production static middleware block

key-decisions:
  - "Static serving is gated on NODE_ENV=production to keep dev workflow unchanged (Vite dev server on :5173)"
  - "SPA fallback checks req.path.startsWith('/api') to let API 404s fall through to errorHandler, not return HTML"
  - "__dirname declared inside the production block (not module top-level) to keep it scoped and avoid unused-variable lint warnings in non-production context"

patterns-established:
  - "Middleware order invariant: security → body parsing → rate limit → API routes → static files → SPA fallback → errorHandler"

# Metrics
duration: 5min
completed: 2026-03-14
---

# Phase 5 Plan 07: Production Static Serving Summary

**Express serves React/Vite production build as static files with SPA fallback, completing the single-PM2-process deployment model.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-14T14:00:00Z
- **Completed:** 2026-03-14T14:05:00Z
- **Tasks:** 1
- **Files modified:** 1 (src/app.js)

## Accomplishments

- Added `path` and `fileURLToPath` imports to app.js for ESM-compatible `__dirname`
- Added production-only static serving block: `express.static(frontend/dist)` after all API routes
- Added SPA fallback `GET *` handler that skips `/api/*` paths and serves `index.html` for all client-side routes
- Confirmed middleware order invariant maintained: API routes → static → SPA fallback → global errorHandler
- Built frontend successfully (554 kB JS bundle, 40 kB CSS, 2027 modules transformed)

## Task Commits

Each task was committed atomically:

1. **Task 1: Express static serving + SPA fallback** - `432eb5f` (feat)

**Plan metadata:** (included in docs commit with SUMMARY.md + STATE.md)

## Files Created/Modified

- `src/app.js` — added `path`/`fileURLToPath` imports and production static serving block (15 lines added)
- `frontend/dist/` — Vite production build output (index.html, JS bundle, CSS bundle)

## Decisions Made

- Static block is inside `if (process.env.NODE_ENV === 'production')` — dev workflow continues using Vite dev server on :5173 without change
- `__dirname` resolved inside the production block using `path.dirname(fileURLToPath(import.meta.url))` — ESM-compatible, scoped to where it is used
- SPA fallback guard `req.path.startsWith('/api')` ensures API 404s propagate to errorHandler instead of returning HTML to API callers

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. The IDE flagged `path` and `fileURLToPath` as "declared but value never read" (hints, not errors) immediately after adding imports but before adding the static block — expected transient state, resolved once the static serving code was added.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Phase 5 (Frontend Foundation + Auth) is fully complete across all 7 plans:

- 05-01: Database migration (AdminUser role field)
- 05-02: Backend role middleware + user management API
- 05-03: Frontend scaffold (React 19 + Vite 8 + shadcn/ui + TanStack Query + Zustand)
- 05-04: Login page, auth store, API client, ProtectedRoute
- 05-05: AppLayout, Sidebar, Header, Dashboard page
- 05-06: Users management page (CRUD table, create/edit dialogs, active toggle)
- 05-07: Production static serving + SPA fallback (this plan)

Phase 6 (Scheduling UI) can begin. The backend scheduling API from v1.0 is already complete. The frontend now has the layout shell, auth infrastructure, and production serving in place.

---
*Phase: 05-frontend-foundation-auth*
*Completed: 2026-03-14*
