---
phase: 06-services-professionals-management
plan: 02
subsystem: ui
tags: [react, tanstack-query, shadcn, prisma, professionals, service-assignment]

# Dependency graph
requires:
  - phase: 05-frontend-foundation
    provides: apiFetch wrapper, ProtectedRoute pattern, controlled dialog pattern, CRUD page pattern
  - phase: 04-admin-api
    provides: professional CRUD endpoints (POST/PUT, assign/remove services)
provides:
  - listAllProfessionals() service function (professionals + assigned services)
  - GET /api/admin/professionals list endpoint (before /:id to avoid param collision)
  - Professionals.jsx CRUD page with create/edit dialogs and service assignment
  - /admin/professionals route protected by ADMIN role
affects:
  - 06-03 (working hours management may reference the professionals list pattern)
  - 07-scheduling-ui (needs professional list for booking assignment)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - ServiceAssignmentDialog with per-service Switch toggles and independent assign/remove mutations
    - Graceful degradation when dependent endpoint (/admin/services) not yet available
    - listAllProfessionals with Prisma select + nested include for services

key-files:
  created:
    - frontend/src/pages/admin/Professionals.jsx
    - src/services/professionalService.js (listAllProfessionals added)
  modified:
    - src/routes/admin/professionals.js (GET / added before /:id)
    - frontend/src/App.jsx (/admin/professionals route added)

key-decisions:
  - "GET / route added BEFORE /:id in professionals router to prevent Express treating / as an ID param"
  - "ServiceAssignmentDialog uses /admin/services endpoint with graceful error state when unavailable (wave 1 parallel execution)"
  - "Each service toggle is an independent mutation (assign/remove) — no bulk save needed"
  - "assignProfessional state holds the full professional object so dialog can show currently assigned services without a separate fetch"

patterns-established:
  - "ServiceAssignmentDialog pattern: full checklist with Switch per service, independent mutations, optimistic invalidation"

# Metrics
duration: 4min
completed: 2026-03-14
---

# Phase 6 Plan 02: Professionals Management Summary

**Professionals CRUD page with multi-select service assignment — backend list endpoint, create/edit dialogs, active toggle, and per-service Switch assignment dialog**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-03-14T14:41:32Z
- **Completed:** 2026-03-14T14:45:02Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- `listAllProfessionals()` added to professionalService.js — returns all professionals (active + inactive) ordered by name, eager-loading assigned services with name
- `GET /api/admin/professionals` route added before `/:id` to prevent Express param collision, returns `{ data: professional[] }`
- `Professionals.jsx` built following Users.jsx pattern: table with Name, Contact, Services (Badge per service), Status, Actions columns; CreateProfessionalDialog, EditProfessionalDialog, ServiceAssignmentDialog; inline active toggle Switch
- `/admin/professionals` wired into App.jsx under ADMIN ProtectedRoute

## Task Commits

Each task was committed atomically:

1. **Task 1: Add backend GET /api/admin/professionals list endpoint** - `109f66c` (feat)
2. **Task 2: Build Professionals.jsx CRUD page with service assignment** - `a479385` (feat)

**Plan metadata:** (see final commit below)

## Files Created/Modified

- `src/services/professionalService.js` - Added `listAllProfessionals()` export
- `src/routes/admin/professionals.js` - Added GET / route (before /:id), imported listAllProfessionals
- `frontend/src/pages/admin/Professionals.jsx` - Full CRUD page: CreateProfessionalDialog, EditProfessionalDialog, ServiceAssignmentDialog, table with all columns, skeleton loading, empty state, error banner
- `frontend/src/App.jsx` - Added Professionals import + /admin/professionals route in ADMIN ProtectedRoute

## Decisions Made

- GET / added **before** GET /:id in the professionals router. Express would otherwise match a bare "/" as an ID param ("/" string sent to UUID validator → validation error).
- `ServiceAssignmentDialog` fetches from `/admin/services` (admin endpoint added by plan 06-01) with `enabled: open` and `retry: 1`. If the endpoint isn't available yet (wave 1 parallel execution), shows a clear error message rather than crashing.
- Each service toggle fires an independent `assignMutation` or `removeMutation` call — no bulk save button. Mirrors real-time UX expectation.
- `assignProfessional` state stores the full professional object so the dialog can immediately show which services are currently assigned without an extra fetch.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Professionals list endpoint ready for scheduling UI (phase 7) — returns full service assignment context
- Service assignment dialog will work seamlessly once plan 06-01 adds GET /admin/services
- Working hours management (06-03 if planned) can follow the same ServiceAssignmentDialog pattern

---
*Phase: 06-services-professionals-management*
*Completed: 2026-03-14*
