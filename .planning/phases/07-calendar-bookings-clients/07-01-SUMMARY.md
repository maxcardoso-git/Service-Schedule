---
phase: 07-calendar-bookings-clients
plan: 01
subsystem: api
tags: [express, prisma, jwt, fullcalendar, bookings, clients, dashboard]

# Dependency graph
requires:
  - phase: 06-services-professionals-management
    provides: working backend with admin auth, bookings PATCH, clients list, dashboard basic stats
provides:
  - GET /api/admin/bookings with date/professionalId/status filters and full relations
  - GET /api/admin/clients/by-phone/:phone (JWT-authenticated phone lookup)
  - POST /api/admin/clients (client registration under JWT auth)
  - GET /api/admin/clients/:id/appointments (appointment history by client UUID)
  - Dashboard stats enhanced with revenueToday, noShowCount, occupancyPercent
  - FullCalendar 6 installed in frontend (react, core, daygrid, timegrid, interaction)
affects: [07-02, 07-03, calendar-ui, receptionist-ui]

# Tech tracking
tech-stack:
  added:
    - "@fullcalendar/react@6.1.20"
    - "@fullcalendar/core@6.1.20"
    - "@fullcalendar/daygrid@6.1.20"
    - "@fullcalendar/timegrid@6.1.20"
    - "@fullcalendar/interaction@6.1.20"
  patterns:
    - "prisma.$queryRaw for SUM aggregation joining booking_services + bookings (Prisma ORM lacks join-based aggregation)"
    - "Conditional where object built from optional query params before findMany call"
    - "by-phone/:phone route declared before /:id routes to prevent Express param collision"
    - "_req convention for unused request param in handler to suppress lint hint"

key-files:
  created: []
  modified:
    - src/routes/admin/bookings.js
    - src/routes/admin/clients.js
    - src/routes/admin/dashboard.js
    - frontend/package.json

key-decisions:
  - "Revenue uses BookingService.price (price at time of booking) not Service.price (current catalog price) — correct for financial accuracy"
  - "revenueToday computed via $queryRaw SUM — avoids fetching all records into JS memory for aggregation"
  - "occupancyPercent formula: (non-cancelled bookings) / (activeProfessionals * 16 slots) * 100, capped at 100 — simple approximation, frontend can refine"
  - "by-phone route placed before /:id/appointments to prevent Express treating literal 'by-phone' as a UUID param"

patterns-established:
  - "Conditional where object: start with {}, add keys conditionally — keeps code flat without nested ternaries"
  - "Stats handler uses _req prefix for unused request param"

# Metrics
duration: 3min
completed: 2026-03-14
---

# Phase 7 Plan 1: Calendar Bookings Clients — Backend Endpoints Summary

**JWT-authenticated booking list with date/professional/status filters, admin client CRUD (phone lookup, registration, appointment history), enhanced dashboard KPIs (revenue, no-show, occupancy), and FullCalendar 6 installed**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-14T14:41:29Z
- **Completed:** 2026-03-14T14:44:19Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Added GET /api/admin/bookings endpoint with optional date/professionalId/status filters, returning bookings with embedded client (id, name, phone), service (id, name, durationMin), and professional (id, name) relations ordered by startTime
- Added three admin-auth client endpoints: phone lookup, client registration (POST /), and appointment history — mirrors the existing apiKey-protected routes under JWT auth, with by-phone route correctly ordered before /:id to prevent Express param collision
- Extended dashboard /stats to return 7 KPIs including revenueToday (SUM via $queryRaw), noShowCount, and occupancyPercent (capped at 100), and installed all 5 FullCalendar 6 packages in the frontend

## Task Commits

Each task was committed atomically:

1. **Task 1: Add admin booking list endpoint and enhanced client routes** - `6dda96f` (feat)
2. **Task 2: Enhance dashboard stats and install FullCalendar** - `4bc0c50` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `src/routes/admin/bookings.js` - Added GET / list endpoint with Zod-validated query params and conditional where object; PATCH /:id/status preserved unchanged
- `src/routes/admin/clients.js` - Added by-phone lookup, POST create, and /:id/appointments routes; all JWT-authenticated with Zod validation
- `src/routes/admin/dashboard.js` - Extended Promise.all with $queryRaw revenue SUM, NO_SHOW count, and non-cancelled count; added occupancyPercent calculation
- `frontend/package.json` - Added @fullcalendar/{react,core,daygrid,timegrid,interaction} v6.1.20

## Decisions Made

- Revenue summed from `BookingService.price` (price captured at booking time) rather than the current `Service.price` — correct for financial accuracy since catalog prices may change after booking
- `$queryRaw` used for revenue SUM (Prisma ORM cannot do join-based aggregation natively)
- Occupancy formula: `Math.min(100, Math.round((nonCancelledToday / (activeProfessionals * 16)) * 100))` — 16 slots assumes 8h day with 30-min intervals; simple approximation acceptable for dashboard KPI
- `_req` naming convention used for the stats handler's unused request parameter to satisfy the TypeScript/ESLint hint reported by the IDE

## Deviations from Plan

None — plan executed exactly as written. The `_req` fix was a minor code-quality adjustment within Task 2 scope (lint hint, not a deviation).

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- GET /api/admin/bookings is ready for FullCalendar event fetching (returns startTime, endTime, status, client name, service name, professional name)
- POST /api/admin/clients and GET /api/admin/clients/by-phone/:phone are ready for receptionist quick-registration flow
- Dashboard stats endpoint returns all 7 KPIs needed by the frontend dashboard page
- FullCalendar 6 installed and importable — ready for 07-02 calendar UI implementation

---
*Phase: 07-calendar-bookings-clients*
*Completed: 2026-03-14*
