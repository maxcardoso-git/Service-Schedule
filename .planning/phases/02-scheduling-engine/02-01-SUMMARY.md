---
phase: 02-scheduling-engine
plan: 01
subsystem: database
tags: [prisma, postgresql, date-fns, date-fns-tz, node-cron, partial-index, scheduling]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: bookings table with BookingStatus enum, prisma schema with Booking model
provides:
  - Partial unique index bookings_active_slot_unique enforcing one active slot per (professional, time)
  - src/lib/slots.js with generateAvailableSlots and localTimeToUTC pure functions
  - date-fns-tz and node-cron dependencies installed
  - Prisma migrations baseline established (migrating from db push to migrate dev workflow)
affects:
  - 02-02 (booking service will use generateAvailableSlots and rely on the conflict index)
  - 02-03 (availability endpoint depends on slot generation)
  - 02-04 (TTL expiry job uses node-cron)

# Tech tracking
tech-stack:
  added:
    - date-fns-tz@3.2.0 (timezone-aware date conversion)
    - node-cron@4.2.1 (scheduled jobs for TTL expiry)
  patterns:
    - Pure function slot generation: no DB calls, no side effects, fully testable
    - Prisma migrate workflow established: baseline migration + incremental migrations going forward
    - camelCase column names: database uses camelCase (no @map attributes in schema) — partial index DDL must match

key-files:
  created:
    - src/lib/slots.js
    - prisma/migrations/20260313000000_baseline/migration.sql
    - prisma/migrations/20260313220717_add_booking_conflict_index/migration.sql
    - prisma/migrations/migration_lock.toml
  modified:
    - package.json
    - package-lock.json

key-decisions:
  - "Column names in migration DDL are camelCase (professionalId, startTime) because schema uses no @map — Prisma preserved camelCase when originally run via db push"
  - "Baseline migration created and marked applied to transition from db push to migrate dev workflow"
  - "Partial index WHERE clause uses BookingStatus enum values: PRE_RESERVED and CONFIRMED"
  - "generateAvailableSlots uses addMinutes cursor loop with slotEnd > workEnd guard — clean and deterministic"

patterns-established:
  - "Pure function pattern for slot generation: Date[] in, Date[] out, no side effects"
  - "fromZonedTime for local-to-UTC conversion (NOT toZonedTime which goes the other direction)"
  - "Prisma migrate dev workflow: all future schema changes via migrations, not db push"

# Metrics
duration: 12min
completed: 2026-03-13
---

# Phase 2 Plan 01: Scheduling Engine Foundation Summary

**PostgreSQL partial unique index for race-condition-safe conflict detection + pure slot generation module using cursor-based addMinutes iteration with date-fns-tz timezone support**

## Performance

- **Duration:** 12 min
- **Started:** 2026-03-13T22:05:00Z
- **Completed:** 2026-03-13T22:17:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Created and applied `bookings_active_slot_unique` partial unique index on `(professionalId, startTime)` WHERE status IN PRE_RESERVED or CONFIRMED — enforces one active booking per slot at database level
- Established Prisma migrate workflow (baseline migration to transition from `db push` state)
- Built `src/lib/slots.js` with two pure, fully-tested exported functions covering all edge cases
- Installed date-fns-tz and node-cron dependencies

## Task Commits

Each task was committed atomically:

1. **Task 1: Install dependencies and create partial unique index migration** - `9d7d1f8` (feat)
2. **Task 2: Create pure slot generation and timezone helper module** - `90a08d9` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `src/lib/slots.js` - Pure slot generation (generateAvailableSlots) and timezone helper (localTimeToUTC)
- `prisma/migrations/20260313000000_baseline/migration.sql` - Baseline migration capturing existing db push state
- `prisma/migrations/20260313220717_add_booking_conflict_index/migration.sql` - Partial unique index DDL
- `prisma/migrations/migration_lock.toml` - Prisma migration lock file
- `package.json` - Added date-fns-tz and node-cron dependencies
- `package-lock.json` - Lockfile updated

## Decisions Made

- **camelCase column names in DDL**: The plan specified snake_case (`professional_id`, `start_time`), but the actual PostgreSQL columns use camelCase because the schema has no `@map` attributes and was originally created via `prisma db push`. The migration DDL was corrected to use `"professionalId"` and `"startTime"`.
- **Baseline migration approach**: Database existed without migration history (created via `db push`). Created a baseline migration using `prisma migrate diff --from-empty --to-schema-datamodel` and marked it applied with `prisma migrate resolve --applied`. All future schema changes now flow through `prisma migrate dev`.
- **Smoke test coverage**: Verified 5 scenarios — basic overlap, empty bookings, fully booked, last-slot boundary (90min), and timezone conversion (America/Sao_Paulo UTC-3).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected snake_case to camelCase column names in partial index DDL**

- **Found during:** Task 1 (applying migration)
- **Issue:** Plan specified `"professional_id"` and `"start_time"` as column names. First apply attempt failed: `column "professional_id" does not exist` because Prisma used camelCase column names (no `@map` attributes in schema).
- **Fix:** Queried `information_schema.columns` to confirm actual column names, updated migration SQL to `"professionalId"` and `"startTime"`.
- **Files modified:** `prisma/migrations/20260313220717_add_booking_conflict_index/migration.sql`
- **Verification:** Migration applied successfully; `pg_indexes` confirms index with correct column references.
- **Committed in:** `9d7d1f8` (Task 1 commit)

**2. [Rule 3 - Blocking] Created baseline migration to resolve db drift**

- **Found during:** Task 1 (running `prisma migrate dev --create-only`)
- **Issue:** Prisma detected drift — database had all tables from previous `db push` but no `_prisma_migrations` table, so `migrate dev` offered to reset the database (destructive).
- **Fix:** Generated baseline SQL via `prisma migrate diff`, created `20260313000000_baseline` migration directory, and marked it applied via `prisma migrate resolve --applied` — preserving existing data.
- **Files modified:** `prisma/migrations/20260313000000_baseline/migration.sql`, `prisma/migrations/migration_lock.toml`
- **Verification:** `prisma migrate status` shows "Database schema is up to date!" with 2 migrations applied.
- **Committed in:** `9d7d1f8` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 bug - wrong column names, 1 blocking - migration drift)
**Impact on plan:** Both fixes were necessary for correct operation. The column name correction was an inaccuracy in the plan's DDL example. The baseline migration was required infrastructure to use `migrate dev` going forward. No scope creep.

## Issues Encountered

- `prisma db execute --stdin` requires either `--url` or `--schema` flag (not documented in plan) — used `psql` directly to query column names.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Partial unique index is live and enforcing conflict constraint at DB level
- `generateAvailableSlots` and `localTimeToUTC` are ready for use in 02-02 booking service
- `node-cron` is installed for the TTL expiry job (02-04)
- Prisma migrate workflow established — all future migrations should use `prisma migrate dev`
- Note for 02-02: When writing `SELECT FOR UPDATE SKIP LOCKED`, use `$queryRaw` (Prisma raw query); the partial index will complement this for double-safety

---
*Phase: 02-scheduling-engine*
*Completed: 2026-03-13*
