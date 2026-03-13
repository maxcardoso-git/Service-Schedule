---
phase: 02-scheduling-engine
verified: 2026-03-13T22:20:43Z
status: gaps_found
score: 2/5 must-haves verified
gaps:
  - truth: "An AI agent calling POST /api/bookings/availability receives calculated available slots"
    status: failed
    reason: "bookingService.js queries Professional with isActive: true but Prisma schema field is active — Prisma throws a validation error on every availability request"
    artifacts:
      - path: "src/services/bookingService.js"
        issue: "Line 48: { isActive: true } in professional findFirst — field does not exist in schema; correct field is 'active'"
      - path: "src/services/bookingService.js"
        issue: "Line 74: { id: serviceId, isActive: true } in service findFirst — same field mismatch; correct field is 'active'"
    missing:
      - "Replace isActive: true with active: true on line 48 (professional query in getAvailableSlots)"
      - "Replace isActive: true with active: true on line 74 (service query in getAvailableSlots)"

  - truth: "An AI agent calling POST /api/bookings with an idempotency key creates a 5-minute hold"
    status: failed
    reason: "createPreReservation also queries service with isActive: true (line 183) — same field mismatch causes Prisma validation error before any booking is created"
    artifacts:
      - path: "src/services/bookingService.js"
        issue: "Line 183: { id: serviceId, isActive: true } in service findFirst within createPreReservation — field does not exist; correct field is 'active'"
    missing:
      - "Replace isActive: true with active: true on line 183 (service query in createPreReservation)"

  - truth: "An AI agent calling PATCH /api/bookings/:id/confirm transitions booking from PRE_RESERVED to CONFIRMED"
    status: failed
    reason: "confirmBooking function itself is correctly implemented with SELECT FOR UPDATE SKIP LOCKED and sets status=CONFIRMED + expiresAt=null, BUT the slot will never reach PRE_RESERVED state because createPreReservation is broken (see gap above). The confirm function in isolation is structurally sound."
    artifacts:
      - path: "src/services/bookingService.js"
        issue: "confirmBooking (lines 240-276) is structurally correct but depends on a booking existing — which cannot be created due to the isActive bug in createPreReservation"
    missing:
      - "Fix createPreReservation (gap 2) so a PRE_RESERVED booking can be created to confirm"
---

# Phase 2: Scheduling Engine Verification Report

**Phase Goal:** AI agents can query available time slots, hold a slot with a pre-reservation, and confirm or cancel a booking — with race-condition-safe conflict detection enforced at the database level.
**Verified:** 2026-03-13T22:20:43Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | AI agent receives calculated available slots from POST /api/bookings/availability with NOT_WORKING or FULLY_BOOKED reason codes | FAILED | bookingService.js line 48 queries `isActive: true`; Prisma schema has `active` — confirmed runtime error via node test |
| 2 | POST /api/bookings with idempotency key creates 5-min hold; second call returns existing hold | FAILED | bookingService.js line 183 queries service with `isActive: true` — same Prisma field mismatch; booking creation always throws |
| 3 | PATCH /api/bookings/:id/confirm transitions PRE_RESERVED to CONFIRMED; slot disappears from availability | FAILED | confirmBooking function is structurally correct, but depends on a booking existing (gap 2 prevents creation) |
| 4 | Two simultaneous attempts on same slot result in exactly one success and one conflict (PostgreSQL partial unique index) | VERIFIED | bookings_active_slot_unique index correctly created on ("professionalId", "startTime") WHERE status IN ('PRE_RESERVED','CONFIRMED') with camelCase column names; index DDL confirmed in migration SQL |
| 5 | Expired pre-reservations are excluded from availability queries without waiting for cleanup | VERIFIED | TTL filter in $queryRaw (line 93-97): status='CONFIRMED' OR (status='PRE_RESERVED' AND "expiresAt" > NOW()) — correctly excludes expired holds at query time |

**Score:** 2/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/slots.js` | Pure slot generation + timezone helper | VERIFIED | 61 lines, exports generateAvailableSlots and localTimeToUTC, no stubs, imported by bookingService.js |
| `src/services/bookingService.js` | 5 scheduling business logic functions | PARTIAL | 353 lines, all 5 functions exported, structurally complete, but isActive field mismatch breaks getAvailableSlots and createPreReservation at runtime |
| `src/routes/bookings.js` | 5 HTTP endpoints at /api/bookings/* | VERIFIED | 85 lines, all 5 routes present with Zod validation and apiKeyAuth, wired to bookingService, mounted in app.js |
| `src/jobs/expireReservations.js` | Cron cleanup for expired PRE_RESERVED bookings | VERIFIED | 23 lines, node-cron every minute, updates expired PRE_RESERVED to CANCELLED, started in server.js listen callback |
| `prisma/migrations/20260313220717_add_booking_conflict_index/migration.sql` | Partial unique index for race-condition safety | VERIFIED | CREATE UNIQUE INDEX bookings_active_slot_unique with camelCase column names and correct WHERE clause |
| `prisma/migrations/20260313000000_baseline/migration.sql` | Baseline migration capturing db push state | VERIFIED | Exists, captures all tables including bookings with idempotencyKey and expiresAt columns |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/routes/bookings.js` | `src/services/bookingService.js` | named imports at line 5-11 | WIRED | All 5 functions imported and called in matching route handlers |
| `src/app.js` | `src/routes/bookings.js` | bookingsRouter at /api/bookings | WIRED | Imported line 13, mounted line 56 |
| `src/server.js` | `src/jobs/expireReservations.js` | startExpiryJob() in listen callback | WIRED | Imported line 4, called inside listen callback line 10 |
| `src/services/bookingService.js` | `src/lib/slots.js` | generateAvailableSlots + localTimeToUTC | WIRED | Imported line 5, both functions called in getAvailableSlots |
| `bookingService.getAvailableSlots` | PostgreSQL bookings table | $queryRaw with TTL filter | PARTIAL | TTL SQL is correct but unreachable — isActive error throws before $queryRaw |
| `bookingService.confirmBooking` | PostgreSQL bookings table | SELECT FOR UPDATE SKIP LOCKED | WIRED | Lines 242-247 correctly use $queryRaw within $transaction |
| `bookings_active_slot_unique` index | PostgreSQL | migration applied | VERIFIED | Partial unique index enforces conflict at DB level |

### Requirements Coverage

| Requirement | Status | Blocking Issue |
|-------------|--------|----------------|
| SCHD-01 (availability endpoint) | BLOCKED | isActive field mismatch in getAvailableSlots prevents execution |
| SCHD-02 (pre-reservation with TTL) | BLOCKED | isActive field mismatch in createPreReservation prevents booking creation |
| SCHD-03 (confirm booking) | BLOCKED | confirmBooking is structurally correct but no bookings can be created to confirm |
| SCHD-04 (cancel booking) | BLOCKED | cancelBooking is structurally correct but same dependency issue |
| SCHD-05 (get bookings by phone) | SATISFIED | getBookingsByPhone has no isActive references; correctly queries client by normalized phone |
| SCHD-06 (next-available forward search) | BLOCKED | Lives inside getAvailableSlots — blocked by same isActive bug |
| SCHD-07 (idempotency on pre-reservation) | BLOCKED | createPreReservation has isActive bug; idempotency logic is structurally correct |
| SCHD-08 (TTL-filtered availability) | BLOCKED | TTL filter SQL is correct but getAvailableSlots never reaches it |
| INFR-03 (conflict detection index) | SATISFIED | bookings_active_slot_unique partial unique index is live in database |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/services/bookingService.js` | 48 | `isActive: true` (field does not exist in Prisma schema; schema has `active`) | Blocker | All calls to getAvailableSlots throw Prisma validation error |
| `src/services/bookingService.js` | 74 | `isActive: true` (same field mismatch in second service query) | Blocker | Same — redundant field check inside getAvailableSlots also fails |
| `src/services/bookingService.js` | 183 | `isActive: true` (field mismatch in createPreReservation) | Blocker | All calls to createPreReservation throw Prisma validation error |
| `src/services/bookingService.js` | 113 | Reason logic: `activeBookings.length > 0 ? 'FULLY_BOOKED' : 'NOT_WORKING'` when slots are empty but professional IS working | Warning | Edge case: if professional works but service duration exceeds remaining window, 'NOT_WORKING' is returned incorrectly — but 'NOT_WORKING' was already excluded by reaching this branch only after workingHours was found; minor misclassification possible |

### Human Verification Required

None — all issues are verifiable programmatically. The `isActive` field mismatch was confirmed via a live Prisma client invocation that returned:

```
Invalid prisma.professional.findFirst() invocation:
Unknown arg `isActive` ... Did you mean `active`?
```

### Gaps Summary

The phase has one root-cause bug that blocks three of the five success criteria: **`bookingService.js` uses `isActive` as the filter field for both Professional and Service queries, but the Prisma schema defines the field as `active`** (visible in `prisma/schema.prisma` lines 29 and 44, and confirmed by `serviceService.js` which correctly uses `active: true`).

This bug appears in three places:

1. `getAvailableSlots` — professional query (line 48)
2. `getAvailableSlots` — service query (line 74)
3. `createPreReservation` — service query (line 183)

The fix is mechanical: replace `isActive` with `active` in all three locations. Once fixed, the underlying logic is sound — the TTL filter, SELECT FOR UPDATE SKIP LOCKED pattern, idempotency replay, and partial unique index are all correctly implemented and wired.

Truths 4 (race-condition-safe index) and 5 (TTL exclusion at query time) are fully verified — the database-level enforcement is correct and live.

---

_Verified: 2026-03-13T22:20:43Z_
_Verifier: Claude (gsd-verifier)_
