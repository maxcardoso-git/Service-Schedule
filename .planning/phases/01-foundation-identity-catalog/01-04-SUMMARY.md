---
phase: 01-foundation-identity-catalog
plan: "04"
subsystem: api
tags: [express, prisma, postgres, zod, jwt, api-key]

requires:
  - phase: 01-02
    provides: auth middleware (apiKeyAuth, adminAuth), error handler, seed data

provides:
  - Public GET /api/services and GET /api/services/:id with API key auth
  - Admin CRUD for services (POST, PUT, PATCH deactivate) with JWT auth
  - Admin professional management (GET, POST, PUT) with JWT auth
  - Admin service assignment to professionals (POST, DELETE) with JWT auth
  - Admin working hours replacement (PUT full replace via transaction) with JWT auth
  - serviceService.js with listActiveServices, getServiceById, createService, updateService, deactivateService
  - professionalService.js with createProfessional, updateProfessional, assignService, removeService, replaceWorkingHours, getProfessionalById

affects:
  - Phase 2 scheduling engine (depends on services, professionals, working hours)
  - Phase 3 booking flows (reads service catalog for agent API)

tech-stack:
  added: []
  patterns:
    - "asyncHandler wrapper for Express routes (inline fn, propagates to errorHandler)"
    - "Service layer: NotFoundError thrown when findUnique returns null"
    - "replaceWorkingHours uses $transaction (deleteMany + createMany) for atomic full replace"
    - "getServiceById filters to active professionals only in result mapping"
    - "ProfessionalService unique constraint [professionalId_serviceId] used for findUnique and delete"

key-files:
  created:
    - src/services/serviceService.js
    - src/services/professionalService.js
    - src/routes/services.js
    - src/routes/admin/services.js
    - src/routes/admin/professionals.js
  modified:
    - src/app.js

key-decisions:
  - "replaceWorkingHours does full delete+createMany in transaction (not upsert) — simpler, prevents orphan records"
  - "getServiceById filters professional list to active:true only in application layer, not query"
  - "Working hours validation happens in service layer before transaction"
  - "assignService lets Prisma P2002 bubble to errorHandler for 409 — consistent with existing pattern"

patterns-established:
  - "asyncHandler: inline (fn) => (req, res, next) => Promise.resolve(...).catch(next) in each route file"
  - "Partial updates: build updateData object only for defined keys (no accidental null overwrites)"
  - "Admin routes: router.use(adminAuth) at top, applies to all routes in file"

duration: 3min
completed: 2026-03-13
---

# Phase 1 Plan 04: Services Catalog Summary

**Express routes + Prisma service layer for full services catalog: public listing for AI agents (API key) + admin CRUD for services, professionals, assignments, and working hours (JWT)**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-13T20:58:13Z
- **Completed:** 2026-03-13T21:01:50Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Public service listing endpoint returns active services with name, durationMin, price — ready for AI agent consumption
- Admin service CRUD (create, update, deactivate) with Zod validation and proper 404/409 handling
- Professional management with service assignments (assign/remove) using ProfessionalService unique constraint
- Working hours replaced atomically via Prisma transaction (deleteMany + createMany)
- All 9 API truths from must_haves verified against seeded data

## Task Commits

1. **Task 1: Service and professional business logic** - `cfd018e` (feat)
2. **Task 2: Routes (public + admin) and app mounting** - `3478f78` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `src/services/serviceService.js` - listActiveServices, getServiceById (with active-prof filter), createService, updateService, deactivateService
- `src/services/professionalService.js` - all professional CRUD + assignService, removeService, replaceWorkingHours
- `src/routes/services.js` - public GET / and GET /:id (apiKeyAuth)
- `src/routes/admin/services.js` - admin POST, PUT /:id, PATCH /:id/deactivate (adminAuth)
- `src/routes/admin/professionals.js` - admin GET /:id, POST, PUT /:id, POST /:id/services, DELETE /:id/services/:sid, PUT /:id/working-hours (adminAuth)
- `src/app.js` - mounted /api/services, /api/admin/services, /api/admin/professionals

## Decisions Made
- `replaceWorkingHours` uses full delete + createMany in a single Prisma transaction rather than upsert — simpler logic, no orphan records possible, transactionally safe
- `getServiceById` filters `professionals` array to active-only in application layer after the query, keeping the include clean
- `assignService` allows the Prisma P2002 unique constraint violation to bubble up to the errorHandler (returns 409 CONFLICT) — consistent with existing client duplicate-phone pattern

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Services catalog fully operational: Phase 2 scheduling engine can read services, professionals, and working hours
- Public `/api/services` endpoint tested with seed data (5 services, 3 professionals with working hours)
- Admin endpoints tested: create service, deactivate, assign/remove service from professional, replace working hours
- Phase 2 can immediately query WorkingHours for slot calculation and Service for duration/price

---
*Phase: 01-foundation-identity-catalog*
*Completed: 2026-03-13*
