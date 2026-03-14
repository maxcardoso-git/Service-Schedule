---
phase: 06-services-professionals-management
plan: 01
subsystem: ui
tags: [react, tanstack-query, shadcn, express, prisma]

# Dependency graph
requires:
  - phase: 05-frontend-foundation
    provides: apiFetch wrapper, ProtectedRoute pattern, Users.jsx CRUD pattern, App.jsx router
provides:
  - GET /api/admin/services endpoint returning all services (active + inactive)
  - PUT /api/admin/services/:id accepts active field for one-click toggle
  - listAllServices() function in serviceService
  - Services.jsx CRUD page with create/edit dialogs, active toggle, status badge
  - /admin/services route protected by ADMIN role
affects:
  - 06-02-professionals (follows same pattern)
  - 08-admin-ui-polish (tables, dialogs, badges reused)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "CRUD page pattern: useQuery fetch + useMutation POST/PUT + invalidateQueries(['queryKey']) + toast"
    - "toggleActiveMutation: inline Switch mutation separate from edit dialog mutation"
    - "Controlled dialog open state with onOpenChange for pre-population"
    - "StatusBadge with green/gray variant based on active boolean"
    - "GET route placed before PUT /:id to avoid route conflicts"

key-files:
  created:
    - frontend/src/pages/admin/Services.jsx
  modified:
    - src/services/serviceService.js
    - src/routes/admin/services.js
    - frontend/src/App.jsx

key-decisions:
  - "Active toggle uses PUT /:id with { active: bool } — reuses existing update endpoint rather than dedicated toggle endpoint"
  - "serviceBodySchema extended with active: z.boolean().optional() so partial() on PUT allows toggle without other fields"
  - "GET / placed before PUT /:id in router registration to prevent route ambiguity"

patterns-established:
  - "Services CRUD page: identical structure to Users.jsx — follow this for Professionals"
  - "Price formatted as: R$ {Number(service.price).toFixed(2)}"
  - "Duration formatted as: {service.durationMin} min"

# Metrics
duration: 3min
completed: 2026-03-14
---

# Phase 6 Plan 01: Services Management Summary

**Admin Services CRUD page with GET /api/admin/services list endpoint, one-click active toggle via PUT, and table UI matching the Users.jsx pattern**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-14T18:21:28Z
- **Completed:** 2026-03-14T18:24:12Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Added `listAllServices()` to serviceService returning all services (active + inactive) ordered by name
- Extended `updateService()` to handle `active` field, enabling one-click toggle via existing PUT endpoint
- Added GET `/api/admin/services` route (placed before PUT `/:id` to avoid conflicts)
- Extended `serviceBodySchema` with `active: z.boolean().optional()` so partial() allows toggle-only requests
- Built `Services.jsx` following exact Users.jsx pattern: table, CreateServiceDialog, EditServiceDialog, StatusBadge, SkeletonRow, error banner
- Wired `/admin/services` into ADMIN-only ProtectedRoute in App.jsx

## Task Commits

1. **Task 1: Add backend GET /api/admin/services list endpoint** - `f7dc255` (feat)
2. **Task 2: Build Services.jsx CRUD page** - `35a0e1d` (feat)

## Files Created/Modified
- `src/services/serviceService.js` - Added `listAllServices()`, extended `updateService()` with active field
- `src/routes/admin/services.js` - Added GET / endpoint, extended serviceBodySchema with active
- `frontend/src/pages/admin/Services.jsx` - Full CRUD page: table, create/edit dialogs, toggle switch
- `frontend/src/App.jsx` - Added /admin/services route inside ADMIN ProtectedRoute

## Decisions Made
- Active toggle reuses PUT `/:id` with `{ active: bool }` rather than adding a dedicated PATCH endpoint — keeps API surface minimal and the schema extension is trivial
- GET route explicitly placed before PUT `/:id` registration to prevent Express route conflict
- `serviceBodySchema` extended at schema definition level (not per-route) so all endpoints benefit from the optional active field consistently

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed unused `req` parameter in GET route handler**
- **Found during:** Task 1 (IDE lint hint after edit)
- **Issue:** `req` declared but never read in `asyncHandler(async (req, res) => ...)` for GET /
- **Fix:** Renamed to `_req` per underscore-prefix convention
- **Files modified:** src/routes/admin/services.js
- **Committed in:** f7dc255 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (lint/style)
**Impact on plan:** Minor style fix only. No scope change.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Services CRUD fully operational; pattern established for Professionals (06-02)
- App.jsx already has /admin/professionals route pre-wired (added externally alongside this plan)
- Professionals.jsx page needs to be built following the same Services.jsx pattern

---
*Phase: 06-services-professionals-management*
*Completed: 2026-03-14*
