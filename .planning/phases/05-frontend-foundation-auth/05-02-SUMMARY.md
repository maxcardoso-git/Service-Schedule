---
phase: 05
plan: 02
subsystem: backend-api
tags: [express, prisma, admin, crud, dashboard]

dependency-graph:
  requires: [05-01]
  provides:
    - Admin user CRUD endpoints (GET, POST, PATCH /api/admin/users)
    - Client listing endpoint (GET /api/admin/clients)
    - Booking status update endpoint (PATCH /api/admin/bookings/:id/status)
    - Dashboard stats endpoint (GET /api/admin/dashboard/stats)
  affects: [05-03, 05-04, 05-05, 05-06, 05-07]

tech-stack:
  added: []
  patterns:
    - Admin service layer (adminUserService) with password exclusion via select
    - Parallel DB queries via Promise.all for dashboard stats
    - Pagination pattern: skip/take with count for total

key-files:
  created:
    - src/services/adminUserService.js
    - src/routes/admin/users.js
    - src/routes/admin/clients.js
    - src/routes/admin/bookings.js
    - src/routes/admin/dashboard.js
  modified:
    - src/services/clientService.js
    - src/services/bookingService.js
    - src/app.js

decisions:
  - description: "ADMIN role required on user management routes only; client/booking/dashboard use adminAuth only"
    rationale: "Receptionists need to view clients and update bookings, but only ADMINs manage user accounts"
  - description: "updateBookingStatus does no status transition validation"
    rationale: "Plan specified simple status update; business rules can be added later if needed"
  - description: "todayBookings uses UTC midnight boundaries"
    rationale: "Consistent with existing server-side date handling; timezone offset is acceptable for dashboard stats"

metrics:
  duration: "~2 min"
  completed: "2026-03-14"
---

# Phase 5 Plan 02: Admin API Endpoints Summary

**One-liner:** Four admin REST endpoints (user CRUD, client list, booking status, dashboard stats) backed by service layer functions, all mounted in app.js.

## What Was Built

### adminUserService.js
- `listAdminUsers()` — returns all admin users via Prisma select (never exposes password)
- `createAdminUser()` — bcrypt hashes password at 10 rounds before create
- `updateAdminUser()` — findUnique guard + strips password key from updates

### Admin Routes
- `GET /api/admin/users` — list all admin users
- `POST /api/admin/users` — create admin user (ADMIN role required)
- `PATCH /api/admin/users/:id` — update name/role/active (ADMIN role required)
- `GET /api/admin/clients` — paginated client list with optional name/phone search
- `PATCH /api/admin/bookings/:id/status` — transition booking status
- `GET /api/admin/dashboard/stats` — todayBookings, totalClients, totalProfessionals, pendingPayments

### Service Extensions
- `clientService.listClients({ search, page, limit })` — OR search on name/phone, skip/take pagination, parallel count
- `bookingService.updateBookingStatus(id, status)` — findUnique guard, update, return with client+services

### app.js
Four new route mounts added after `adminProfessionalsRouter`, before booking routes.

## Decisions Made

| Decision | Rationale |
|---|---|
| requireRole('ADMIN') only on /api/admin/users | Receptionists need client/booking access but not user management |
| No status transition guard in updateBookingStatus | Simple admin override; business rules added when needed |
| UTC midnight for todayBookings | Consistent with existing date handling patterns |

## Deviations from Plan

None — plan executed exactly as written.

## Next Phase Readiness

All frontend plans (05-03 through 05-07) can now call these endpoints directly. The admin API surface is complete for Phase 5 needs.
