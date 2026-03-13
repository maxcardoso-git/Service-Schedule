---
phase: 03-payment-engine
plan: 01
subsystem: payments
tags: [prisma, postgresql, pix, payment, decimal, enum]

# Dependency graph
requires:
  - phase: 02-scheduling-engine
    provides: Booking model with CONFIRMED status and BookingService with price snapshot
provides:
  - PaymentStatus enum (PENDING, PAID, CANCELLED) in Prisma schema
  - Payment model with bookingId @unique, amount Decimal(10,2), pixPayload Text
  - Booking reverse relation: payment Payment?
  - paymentService.js with createPixIntent, getPaymentStatus, simulatePaid
affects: [03-02-payment-routes, 03-03-mcp-tools-payment]

# Tech tracking
tech-stack:
  added: []
  patterns: [P2002 race-safety on unique constraint via try/catch re-throw, PIX-SIM payload format, BookingService.price snapshot for payment amount]

key-files:
  created:
    - prisma/migrations/20260313225052_add_payment_model/migration.sql
    - src/services/paymentService.js
  modified:
    - prisma/schema.prisma

key-decisions:
  - "Payment amount sourced from BookingService.price (snapshot), NOT Service.price — preserves historical price at booking time"
  - "PIX payload format: PIX-SIM:txid={uuid-no-dashes-uppercase}:booking={bookingId}:amount={amount}"
  - "P2002 caught in createPixIntent and re-thrown as ConflictError — race condition safety for concurrent payment creation"
  - "Payment model uses camelCase field names, no @map on individual fields — consistent with project convention"

patterns-established:
  - "generatePixPayload: private helper at module scope (not exported), takes bookingId and amount string"
  - "Status guard in simulatePaid: check status !== PENDING before update, throw ConflictError with current status in message"

# Metrics
duration: 2min
completed: 2026-03-13
---

# Phase 3 Plan 01: Payment Engine — Schema & Service Summary

**PaymentStatus enum + Payment model migrated to PostgreSQL, paymentService.js ships createPixIntent (PIX-SIM payload + price snapshot), getPaymentStatus, and simulatePaid with P2002 race safety**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-13T22:50:22Z
- **Completed:** 2026-03-13T22:52:13Z
- **Tasks:** 2
- **Files modified:** 3 (schema.prisma, migration.sql, paymentService.js)

## Accomplishments

- PaymentStatus enum and Payment model added to Prisma schema with bookingId @unique constraint
- Migration `add_payment_model` applied cleanly; Prisma client regenerated with Payment model
- paymentService.js implements all three business functions with correct error types and P2002 race safety

## Task Commits

Each task was committed atomically:

1. **Task 1: Add Payment model to Prisma schema and run migration** - `ba74e05` (feat)
2. **Task 2: Create payment service layer with three business functions** - `0228c10` (feat)

## Files Created/Modified

- `prisma/schema.prisma` - Added PaymentStatus enum, Payment model, Booking.payment reverse relation
- `prisma/migrations/20260313225052_add_payment_model/migration.sql` - Creates payments table with unique constraint on bookingId
- `src/services/paymentService.js` - createPixIntent, getPaymentStatus, simulatePaid with full error handling

## Decisions Made

- Payment amount sourced from BookingService.price (snapshot), NOT Service.price — preserves historical price at booking time even if the service price changes later
- PIX-SIM payload format: `PIX-SIM:txid={32-char-uppercase-uuid}:booking={bookingId}:amount={amount}` — readable, deterministic structure for simulation
- P2002 caught in createPixIntent and re-thrown as ConflictError — guards against race conditions on the bookingId unique constraint
- Payment model fields remain camelCase with no @map attributes — consistent with all other models in the project

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Payment table exists in PostgreSQL with correct schema; Prisma client has full Payment model typings
- paymentService.js ready to be wired into Express routes in 03-02
- All three business functions tested manually via module import verification

---
*Phase: 03-payment-engine*
*Completed: 2026-03-13*
