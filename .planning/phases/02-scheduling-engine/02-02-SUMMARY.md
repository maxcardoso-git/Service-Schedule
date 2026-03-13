---
phase: 02-scheduling-engine
plan: 02
subsystem: scheduling
tags: [booking, availability, pre-reservation, idempotency, select-for-update, ttl, date-fns, date-fns-tz, prisma]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: bookings table, Booking Prisma model, BookingStatus enum, prisma schema
  - phase: 02-01
    provides: generateAvailableSlots, localTimeToUTC, partial unique index, date-fns-tz
provides:
  - src/services/bookingService.js with all 5 scheduling business logic functions
affects:
  - 02-03 (availability + pre-reservation routes will import getAvailableSlots, createPreReservation)
  - 02-04 (cancel/confirm routes will import cancelBooking, confirmBooking)
  - 03-xx (AI agent API routes will delegate to this service layer)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - SELECT FOR UPDATE SKIP LOCKED inside prisma.$transaction for race-condition-safe status transitions
    - Idempotency replay: findUnique before insert, P2002 catch as safety net
    - TTL-filtered $queryRaw with camelCase double-quoted column names (no @map in schema)
    - 14-day forward search for next-available date (per-day working hours check)
    - Reason codes NOT_WORKING / FULLY_BOOKED on zero-slot responses

key-files:
  created:
    - src/services/bookingService.js
  modified: []

key-decisions:
  - "camelCase column names used in all raw SQL: professionalId, startTime, endTime, expiresAt (confirmed from 02-01)"
  - "idempotency key checked via findUnique BEFORE insert attempt — P2002 catch is secondary safety net"
  - "confirmBooking clears expiresAt (sets null) on CONFIRMED status — prevents stale TTL from triggering expiry job"
  - "cancelBooking uses same SELECT FOR UPDATE SKIP LOCKED pattern as confirmBooking for consistency"
  - "getBookingsByPhone normalizes phone with replace(/D/g,'') before lookup — matches clientService pattern"

patterns-established:
  - "prisma.$transaction + tx.$queryRaw for pessimistic locking pattern (SELECT FOR UPDATE SKIP LOCKED)"
  - "TTL filter: status=CONFIRMED OR (status=PRE_RESERVED AND expiresAt > NOW()) — excludes expired holds"
  - "P2002 target inspection: Array.isArray(target) check before string join for safe includes() test"

# Metrics
duration: 1min
completed: 2026-03-13
---

# Phase 2 Plan 02: Booking Service Layer Summary

**Complete scheduling business logic layer: TTL-filtered availability with next-available search, idempotent pre-reservation with 5-min hold, pessimistic-lock confirm/cancel transitions, and phone-based booking lookup**

## Performance

- **Duration:** ~1 min
- **Started:** 2026-03-13T22:12:14Z
- **Completed:** 2026-03-13T22:13:28Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- Built `src/services/bookingService.js` with all 5 required exports (353 lines)
- `getAvailableSlots`: timezone-aware day boundary conversion, TTL-filtered `$queryRaw`, reason codes, 14-day next-available forward search
- `createPreReservation`: idempotency replay via `findUnique` before insert, P2002 catch differentiating `IDEMPOTENCY_CONFLICT` vs `SLOT_CONFLICT`, 5-minute `expiresAt` TTL
- `confirmBooking`: `SELECT FOR UPDATE SKIP LOCKED` in `$transaction`, TTL expiry check, clears `expiresAt` on confirm
- `cancelBooking`: same pessimistic lock pattern, validates PRE_RESERVED|CONFIRMED before transition
- `getBookingsByPhone`: phone normalization, `CLIENT_NOT_FOUND` error, desc-ordered history

## Task Commits

1. **Tasks 1+2: Full booking service implementation** - `d8f8664` (feat)

## Files Created/Modified

- `src/services/bookingService.js` — All scheduling business logic (5 exported functions)

## Decisions Made

- **camelCase in raw SQL**: All `$queryRaw` calls use double-quoted camelCase column names (`"professionalId"`, `"startTime"`, `"endTime"`, `"expiresAt"`) — consistent with 02-01 finding that schema has no `@map` attributes
- **idempotency-before-insert**: `findUnique` called before the transaction to return existing booking immediately; P2002 catch is secondary safety net if concurrent requests race past the pre-check
- **expiresAt cleared on confirm**: `tx.booking.update({ data: { status: 'CONFIRMED', expiresAt: null } })` prevents the TTL expiry cron job (02-04) from incorrectly cancelling a confirmed booking
- **Unified locking pattern**: Both `confirmBooking` and `cancelBooking` use `SELECT FOR UPDATE SKIP LOCKED` + returning `BOOKING_LOCKED` error on empty rows — symmetric, consistent, race-condition-safe

## Deviations from Plan

None — plan executed exactly as written. camelCase column name correction was pre-documented in the plan prompt (correction from 02-01).

## Issues Encountered

None.

## User Setup Required

None.

## Next Phase Readiness

- All 5 booking service functions are ready for route wiring (02-03, 02-04)
- TTL filter is live in `getAvailableSlots` — expired pre-reservations are invisible at query time (SCHD-08 satisfied)
- `SELECT FOR UPDATE SKIP LOCKED` + partial unique index from 02-01 provide two layers of race-condition protection
- Error codes (`PROFESSIONAL_NOT_FOUND`, `SERVICE_NOT_FOUND`, `SERVICE_NOT_OFFERED`, `SLOT_CONFLICT`, `IDEMPOTENCY_CONFLICT`, `BOOKING_LOCKED`, `INVALID_STATUS_TRANSITION`, `RESERVATION_EXPIRED`, `CLIENT_NOT_FOUND`) ready for route-level response shaping

---
*Phase: 02-scheduling-engine*
*Completed: 2026-03-13*
