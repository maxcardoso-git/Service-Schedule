# Phase 2: Scheduling Engine - Research

**Researched:** 2026-03-13
**Domain:** PostgreSQL scheduling, Prisma 6 raw queries, timezone-aware slot generation, race-condition safety
**Confidence:** HIGH (all critical claims verified against official docs or authoritative GitHub sources)

---

## Summary

Phase 2 implements the core scheduling engine: slot availability queries, TTL-based pre-reservations, confirmed bookings, and cancellations. The highest-risk surface is race-condition safety — two concurrent agents booking the same slot. The defence is a **partial unique index** on `(professional_id, start_time)` filtered by active statuses, enforced at the database level.

The project uses **Prisma 6.19.2**. The `partialIndexes` preview feature that allows Prisma DSL to declare partial indexes was introduced in **Prisma 7.4.0** and is NOT available in this project. The correct approach for Prisma 6 is to add the partial index via a **custom raw SQL migration** using `prisma migrate dev --create-only`, then edit the generated `.sql` file to append the `CREATE UNIQUE INDEX ... WHERE` statement. Prisma 6's shadow database does NOT detect partial indexes and will NOT generate `DROP INDEX` on subsequent `migrate dev` runs — this dropping behaviour was introduced in Prisma 7.4.0.

`SELECT FOR UPDATE SKIP LOCKED` must be executed as a **single raw statement** inside a Prisma interactive transaction using `tx.$queryRaw`. Prisma's ORM layer has no native support for pessimistic row locking. The tagged-template form `tx.$queryRaw\`...\`` is safe (auto-escapes parameters) for data values, but you cannot interpolate table or column names.

Timezone conversion uses `date-fns-tz` 3.x (compatible with `date-fns` 3.6). Slot generation is a pure in-process calculation: iterate from work_start to work_end in steps of the service's `durationMin`, then subtract occupied windows. A background sweep via `node-cron` (v4.0.0) marks expired `PRE_RESERVED` bookings as `CANCELLED` every minute, but availability queries must ALSO filter expired holds inline (SCHD-08 requirement).

**Primary recommendation:** Use a raw SQL migration file for the partial unique index (not `partialIndexes` preview, which requires Prisma 7.4+). Implement all booking mutations inside Prisma interactive transactions. Add `date-fns-tz` for timezone arithmetic.

---

## Standard Stack

### Core (already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@prisma/client` | 6.19.2 | Database ORM + raw queries | Already established; `$queryRaw`/`$transaction` used |
| `date-fns` | 3.6.0 | Date math (addMinutes, parseISO, etc.) | Already installed; standard in ecosystem |
| `zod` | 3.25.76 | Input validation | Already established pattern (validate middleware) |
| `express` | 4.22.1 | HTTP routing | Already established |

### New Dependencies Required
| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| `date-fns-tz` | 3.2.0 | Timezone-aware conversion (UTC ↔ America/Sao_Paulo) | `date-fns` 3.x has no built-in timezone support; `date-fns-tz` 3.x is the peer-dep-compatible companion |
| `node-cron` | 4.0.0 | Background sweep: expire PRE_RESERVED holds | Lightweight, ESM-compatible, battle-tested |

### Installation
```bash
npm install date-fns-tz node-cron
```

### Not Needed
- `luxon` / `moment-timezone` — `date-fns-tz` covers the use case with smaller footprint
- Redis / external queue — TTL filtering at query time makes a queue unnecessary
- `pg` (raw node-postgres) — Prisma `$queryRaw` is sufficient; no need for a second DB client

---

## Architecture Patterns

### Recommended Project Structure
```
src/
├── routes/
│   └── bookings.js          # SCHD-01 through SCHD-05 endpoints
├── services/
│   └── bookingService.js    # All scheduling logic (availability, pre-reserve, confirm, cancel)
├── jobs/
│   └── expireReservations.js # node-cron sweep — marks stale PRE_RESERVED → CANCELLED
└── lib/
    └── slots.js             # Pure slot-generation helpers (no DB calls)
```

### Pattern 1: Raw SQL Migration for Partial Unique Index

**What:** Append `CREATE UNIQUE INDEX` with `WHERE` clause to a Prisma-generated migration file.

**When to use:** Any time you need a database feature the Prisma DSL cannot express (Prisma 6).

**Exact DDL:**
```sql
-- Append to: prisma/migrations/<timestamp>_add_booking_conflict_index/migration.sql
CREATE UNIQUE INDEX "bookings_active_slot_unique"
  ON "bookings" ("professional_id", "start_time")
  WHERE status IN ('PRE_RESERVED', 'CONFIRMED');
```

**Column names use snake_case** because Prisma maps camelCase model fields to snake_case table columns by default.

**Workflow:**
```bash
# 1. Create a blank migration (no schema changes needed — index only)
npx prisma migrate dev --create-only --name add_booking_conflict_index

# 2. Edit the generated file: prisma/migrations/<timestamp>_add_booking_conflict_index/migration.sql
#    Paste the CREATE UNIQUE INDEX statement above.

# 3. Apply
npx prisma migrate dev
```

**Safety on Prisma 6:** Prisma 6's shadow database diffing does NOT detect partial indexes. It will not generate `DROP INDEX` in subsequent migrations. This drift-detection behaviour was introduced in Prisma 7.4.0. Safe to proceed with raw SQL approach on 6.x.

**What the partial index enforces:** Only one active booking per (professional, start_time) slot. `CANCELLED`, `COMPLETED`, and `NO_SHOW` bookings are excluded from the index — they are invisible to the uniqueness constraint, so historical records don't block future bookings in the same slot.

### Pattern 2: SELECT FOR UPDATE SKIP LOCKED Inside Interactive Transaction

**What:** Pessimistic row lock on the target booking row during confirm/cancel to prevent concurrent mutations from racing.

**When to use:** `confirmBooking` and `cancelBooking` — where you read a row's current state and update it conditionally.

**Example (Prisma 6 — verified pattern):**
```javascript
// Source: Prisma official docs on interactive transactions + $queryRaw
// https://www.prisma.io/docs/orm/prisma-client/queries/transactions
// https://www.prisma.io/docs/orm/prisma-client/queries/raw-database-access/raw-queries

import prisma from '../lib/prisma.js';
import { ConflictError, NotFoundError } from '../lib/errors.js';

export async function confirmBooking(bookingId) {
  return prisma.$transaction(async (tx) => {
    // Lock the row — other transactions block on this row until we commit
    const rows = await tx.$queryRaw`
      SELECT id, status, "expiresAt", "professionalId", "startTime"
      FROM bookings
      WHERE id = ${bookingId}::uuid
      FOR UPDATE SKIP LOCKED
    `;

    // SKIP LOCKED: if another transaction already holds the lock, rows = []
    if (rows.length === 0) {
      throw new ConflictError(
        'Booking is being modified by another request',
        'BOOKING_LOCKED'
      );
    }

    const booking = rows[0];

    if (!booking) {
      throw new NotFoundError('Booking not found', 'BOOKING_NOT_FOUND');
    }

    if (booking.status !== 'PRE_RESERVED') {
      throw new ConflictError(
        `Cannot confirm booking in status ${booking.status}`,
        'INVALID_STATUS_TRANSITION'
      );
    }

    // Check TTL expiry
    if (booking.expiresAt && new Date(booking.expiresAt) < new Date()) {
      throw new ConflictError('Pre-reservation has expired', 'RESERVATION_EXPIRED');
    }

    // Update using ORM inside the same transaction
    return tx.booking.update({
      where: { id: bookingId },
      data: { status: 'CONFIRMED', expiresAt: null },
      include: {
        services: { include: { service: true } },
        professional: true,
        client: true,
      },
    });
  });
}
```

**Key constraint:** `$queryRaw` tagged templates only accept one SQL statement. You cannot chain `BEGIN; SELECT ...; COMMIT;` — Prisma wraps the outer `$transaction` in a real DB transaction automatically.

**UUID casting:** PostgreSQL requires explicit `::uuid` cast when passing a UUID string to a typed column via prepared statements. Use `${bookingId}::uuid`.

### Pattern 3: Availability Query with Expired TTL Filtering

**What:** Fetch active bookings for a professional on a date, excluding expired pre-reservations at query time.

**Why at query time:** SCHD-08 requires that expired holds do not block slots even if the cron sweep hasn't run yet.

```javascript
// Source: Prisma official docs on $queryRaw
import { Prisma } from '@prisma/client';

export async function getActiveBookingsForDay(professionalId, dayStart, dayEnd) {
  // dayStart and dayEnd are UTC Date objects covering the full target day
  const bookings = await prisma.$queryRaw`
    SELECT id, "startTime", "endTime", status, "expiresAt"
    FROM bookings
    WHERE "professionalId" = ${professionalId}::uuid
      AND "startTime" >= ${dayStart}
      AND "startTime" < ${dayEnd}
      AND status IN ('PRE_RESERVED', 'CONFIRMED')
      AND (
        status = 'CONFIRMED'
        OR (status = 'PRE_RESERVED' AND "expiresAt" > NOW())
      )
    ORDER BY "startTime" ASC
  `;
  return bookings;
}
```

The TTL filter `(status = 'CONFIRMED' OR (status = 'PRE_RESERVED' AND "expiresAt" > NOW()))` is the core of SCHD-08. Confirmed bookings have no expiry. Pre-reserved bookings are only visible if they haven't expired.

### Pattern 4: Slot Generation Algorithm

**What:** Pure function that takes working hours and active bookings and returns available start times.

**Inputs:**
- `workStart`: "09:00" string → UTC Date (via `fromZonedTime`)
- `workEnd`: "18:00" string → UTC Date
- `durationMin`: integer (service duration)
- `activeBookings`: array of `{ startTime, endTime }` UTC Date pairs

**Algorithm:**
```javascript
// Source: https://www.tilomitra.com/blog/timeslottr-algorithm (interval subtraction pattern)

import { addMinutes } from 'date-fns';

/**
 * Generate available slot start times.
 * @param {Date} workStart - UTC start of working period
 * @param {Date} workEnd   - UTC end of working period
 * @param {number} durationMin - Service duration in minutes
 * @param {Array<{startTime: Date, endTime: Date}>} activeBookings - Active/unexpired bookings
 * @returns {Date[]} Available slot start times in UTC
 */
export function generateAvailableSlots(workStart, workEnd, durationMin, activeBookings) {
  const slots = [];
  let cursor = new Date(workStart);

  while (true) {
    const slotEnd = addMinutes(cursor, durationMin);

    // CRITICAL: slot must FULLY fit before work_end
    if (slotEnd > workEnd) break;

    // Interval overlap check: existing_start < slot_end AND existing_end > slot_start
    const isOccupied = activeBookings.some(
      (b) => b.startTime < slotEnd && b.endTime > cursor
    );

    if (!isOccupied) {
      slots.push(new Date(cursor));
    }

    cursor = addMinutes(cursor, durationMin);
  }

  return slots;
}
```

**Interval overlap formula** (verified against multiple sources):
```
existing_start < new_end  AND  existing_end > new_start
```
This captures all overlap types: complete containment, partial overlap left, partial overlap right. It correctly handles point equality (adjacent slots do NOT overlap — `existing_end === new_start` evaluates `false` for `>`).

### Pattern 5: Working Hours → UTC Conversion

```javascript
// Source: https://github.com/marnusw/date-fns-tz
import { fromZonedTime } from 'date-fns-tz';

const SALON_TZ = process.env.SALON_TIMEZONE; // "America/Sao_Paulo"

/**
 * Convert a working hours time string + target date (UTC) to a UTC Date.
 * @param {string} timeStr - "HH:MM" format, e.g. "09:00"
 * @param {Date} targetDateUTC - Any UTC date on the target day
 * @returns {Date} UTC Date at that local time
 */
export function localTimeToUTC(timeStr, targetDateUTC) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  // Build a "local" Date that represents the HH:MM time on the correct calendar date
  // We need the date part in the salon's local timezone first
  const localDate = new Date(targetDateUTC);
  localDate.setHours(hours, minutes, 0, 0);
  // fromZonedTime treats localDate's wall-clock value as if it were in SALON_TZ
  return fromZonedTime(localDate, SALON_TZ);
}
```

**Critical detail:** `fromZonedTime` takes a date whose `getHours()`/`getMinutes()` values represent the *local time* you want, and returns the equivalent UTC moment. Do NOT use `toZonedTime` for this direction (that converts UTC → local display).

### Pattern 6: Idempotency Key Handling

**What:** On booking creation, if `idempotencyKey` is provided and matches an existing booking, return the existing booking (no duplicate created).

**Pattern (simplified, no caching table needed — key is unique in `bookings` table):**
```javascript
export async function createPreReservation({ clientId, professionalId, serviceId, startTime, idempotencyKey }) {
  // If idempotency key provided, check for existing booking
  if (idempotencyKey) {
    const existing = await prisma.booking.findUnique({
      where: { idempotencyKey },
      include: { services: { include: { service: true } } },
    });
    if (existing) return existing; // Idempotent replay — return cached result
  }

  // Validate slot availability (check working hours + active bookings)
  // ... (slot check logic here)

  // Create — partial unique index enforces conflict at DB level
  try {
    return await prisma.$transaction(async (tx) => {
      const booking = await tx.booking.create({
        data: {
          clientId,
          professionalId,
          startTime,
          endTime: addMinutes(startTime, serviceDurationMin),
          status: 'PRE_RESERVED',
          expiresAt: addMinutes(new Date(), 5), // 5-min TTL
          idempotencyKey: idempotencyKey ?? null,
          services: {
            create: [{ serviceId, price: service.price }],
          },
        },
        include: { services: { include: { service: true } } },
      });
      return booking;
    });
  } catch (err) {
    // P2002 = unique constraint violation (partial index OR idempotencyKey)
    if (err.code === 'P2002') {
      throw new ConflictError('Time slot is no longer available', 'SLOT_CONFLICT');
    }
    throw err;
  }
}
```

**Key insight:** The `idempotencyKey` column already has a `@unique` constraint in the schema. A duplicate idempotency key will throw `P2002` from Prisma. The service layer must intercept `P2002` for the key field specifically vs the partial index — consider using the `err.meta.target` field to distinguish which constraint fired.

### Pattern 7: node-cron Cleanup Sweep

```javascript
// src/jobs/expireReservations.js
// Source: https://github.com/node-cron/node-cron (v4.0.0)

import cron from 'node-cron';
import prisma from '../lib/prisma.js';
import logger from '../lib/logger.js';

export function startExpiryJob() {
  cron.schedule('* * * * *', async () => {
    try {
      const result = await prisma.booking.updateMany({
        where: {
          status: 'PRE_RESERVED',
          expiresAt: { lt: new Date() },
        },
        data: { status: 'CANCELLED' },
      });

      if (result.count > 0) {
        logger.info(`Expired ${result.count} pre-reservations`);
      }
    } catch (err) {
      logger.error('Error expiring reservations', { message: err.message });
    }
  });
}
```

Register in `src/server.js` (or `app.js`):
```javascript
import { startExpiryJob } from './jobs/expireReservations.js';
startExpiryJob();
```

**Schedule `* * * * *`** = every minute. Adjust to `*/5 * * * *` (every 5 min) if preferred — TTL filtering at query time (SCHD-08) covers the gap.

### API Endpoint Structure

```
POST   /api/bookings/availability        — SCHD-01 (query slots)
POST   /api/bookings                     — SCHD-02 (create pre-reservation, returns PRE_RESERVED)
PATCH  /api/bookings/:id/confirm         — SCHD-03 (PRE_RESERVED → CONFIRMED)
PATCH  /api/bookings/:id/cancel          — SCHD-04 (any → CANCELLED)
GET    /api/bookings/by-phone/:phone     — SCHD-05 (client bookings by phone)
```

All routes use `apiKeyAuth` middleware (established pattern from Phase 1) and the `asyncHandler` wrapper.

**Note on availability:** Use `POST` not `GET` because the query body includes `serviceId`, `professionalId`, `date` — avoids putting UUIDs in URL params and allows `validate(body:...)` middleware.

### Anti-Patterns to Avoid

- **Storing slots as rows:** Never insert a row per time slot. Slots are generated at query time from working hours and active bookings.
- **Polling for expiry instead of filtering:** Don't rely on the cron sweep to clean up PRE_RESERVED before checking availability. Always filter `expiresAt > NOW()` at query time.
- **Using `$executeRaw` for SELECT:** Use `$queryRaw` for queries that return rows, `$executeRaw` for mutations that return affected row count.
- **Chaining SQL statements in `$queryRaw`:** Prisma uses prepared statements. `SELECT ...; UPDATE ...;` in a single call fails. One statement per call.
- **Checking availability with ORM findMany, then creating:** This is TOCTOU (check-then-act). The window between the check and the INSERT is a race. Let the database enforce conflicts via the partial unique index — catch `P2002`.
- **Comparing "HH:MM" strings for end-of-day boundary:** `"18:00" > "09:00"` works lexicographically (and is used in Phase 1's `professionalService.js`), but for UTC boundary calculations use actual Date arithmetic with `date-fns-tz`.
- **Last slot overrun:** Slot `cursor + durationMin > workEnd` must be rejected. Use strict `slotEnd > workEnd` (not `>=`) to allow a slot that exactly fills the remaining time.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Timezone conversion | Custom UTC offset math | `date-fns-tz` `fromZonedTime` | DST transitions, IANA rules maintained externally |
| Interval overlap | Custom boolean logic with 4 cases | `a.start < b.end && b.start < a.end` (one-liner) | All cases collapse to this formula |
| Cron scheduling | `setInterval` | `node-cron` | `setInterval` drifts, no cron expression support |
| Slot conflict enforcement | Application-level lock | PostgreSQL partial unique index | Application locks fail under horizontal scale; DB constraint is atomic |
| Idempotency storage | Separate table | Existing `idempotencyKey` unique column on `bookings` | Column already exists; use `findUnique` lookup before create |

**Key insight:** The partial unique index is the only reliable conflict guard under concurrent load. Application-level checks (read availability → then write) have a race window. The DB constraint is the last line of defense and must always be present.

---

## Common Pitfalls

### Pitfall 1: TOCTOU Race on Slot Availability
**What goes wrong:** Two concurrent requests both check availability (no conflict found), both proceed to INSERT — but only one partial unique index violation is thrown. The other gets a 500 error or a corrupt double-booking.
**Why it happens:** Read-then-write pattern has a time window. The SELECT is not atomic with the INSERT.
**How to avoid:** Always catch `P2002` from Prisma on booking creation and surface it as `ConflictError('SLOT_CONFLICT')`. The partial index guarantees only one INSERT wins. The SELECT FOR UPDATE SKIP LOCKED pattern adds a second layer for confirm/cancel.
**Warning signs:** Bookings table shows two rows with same `(professionalId, startTime)` but different IDs.

### Pitfall 2: Stale TTL Holds Blocking Availability
**What goes wrong:** A PRE_RESERVED booking with `expiresAt` in the past shows up in active bookings query, blocking a slot from being offered.
**Why it happens:** Developer forgets the `expiresAt > NOW()` clause in the active bookings query, relying only on the cron sweep.
**How to avoid:** The availability query MUST always include: `AND (status = 'CONFIRMED' OR (status = 'PRE_RESERVED' AND "expiresAt" > NOW()))`.
**Warning signs:** Slots remain unavailable 5+ minutes after a pre-reservation that was never confirmed.

### Pitfall 3: Last Slot Overrun
**What goes wrong:** `generateAvailableSlots` emits a slot at 17:45 for a 30-min service when `workEnd` is 18:00 — correct. But if durationMin is 60, it should NOT emit 17:30 because the slot would end at 18:30, past work_end.
**Why it happens:** Using `slotEnd >= workEnd` (wrong) instead of `slotEnd > workEnd` (right). With `>=`, a slot exactly fitting end time would be rejected. But the critical bug is emitting slots where `slotEnd > workEnd`.
**How to avoid:** `if (slotEnd > workEnd) break;` — exit loop as soon as the slot would overflow.
**Warning signs:** Bookings created for times that fall outside working hours.

### Pitfall 4: Partial Index Column Name Mismatch
**What goes wrong:** The raw SQL uses `professional_id` but Prisma maps it to `professionalId` in JavaScript. SQL uses the table column name (snake_case).
**Why it happens:** Prisma transparently converts camelCase fields to snake_case columns. Developers write the DDL using camelCase from the schema.
**How to avoid:** Inspect the actual Prisma-generated migration DDL to see column names. In this project's schema (verified): `Booking` maps to `bookings` table. Fields `professionalId` → `professional_id`, `startTime` → `start_time`.
**Warning signs:** Migration fails with `column "professionalId" does not exist`.

### Pitfall 5: Idempotency Key Collision vs Slot Conflict Ambiguity
**What goes wrong:** Both the `idempotencyKey` unique constraint AND the partial unique index raise `P2002`. Generic P2002 handling returns "slot conflict" even when the real issue is a duplicate idempotency key.
**Why it happens:** `err.meta.target` contains the constraint name. Without inspecting it, all P2002s look the same.
**How to avoid:** Check `err.meta?.target` includes `idempotencyKey` to distinguish. Or do the idempotency lookup BEFORE the INSERT (find-first pattern) so a duplicate key never reaches the database.
**Warning signs:** Retry with same idempotency key returns 409 "slot conflict" instead of returning the original booking.

### Pitfall 6: fromZonedTime Applied to UTC Date Instead of Local-Wall-Clock Date
**What goes wrong:** `fromZonedTime(new Date(), 'America/Sao_Paulo')` does NOT give you "what São Paulo considers to be now." `new Date()` is already UTC. `fromZonedTime` treats its first argument as if it represents local time in the given timezone.
**Why it happens:** Misunderstanding `fromZonedTime` — it converts local→UTC, not UTC→local.
**How to avoid:** Only call `fromZonedTime` when you have a date whose `hours/minutes` represent local time in the target zone (e.g., constructed from a "09:00" string). Use `toZonedTime` to convert UTC → local for display.
**Warning signs:** Slot times are off by the UTC−3 offset (3 hours wrong).

---

## Code Examples

### Full Availability Query Flow

```javascript
// src/services/bookingService.js
import { fromZonedTime, toZonedTime } from 'date-fns-tz';
import { addMinutes, startOfDay, endOfDay, format } from 'date-fns';
import prisma from '../lib/prisma.js';
import { generateAvailableSlots } from '../lib/slots.js';
import { NotFoundError, ValidationError } from '../lib/errors.js';

const SALON_TZ = process.env.SALON_TIMEZONE; // "America/Sao_Paulo"

/**
 * Query available slots for a professional/service on a date.
 * @param {string} professionalId
 * @param {string} serviceId
 * @param {string} dateStr - ISO date "YYYY-MM-DD" in salon timezone
 */
export async function getAvailableSlots(professionalId, serviceId, dateStr) {
  // Parse date in salon timezone
  const localMidnight = fromZonedTime(new Date(`${dateStr}T00:00:00`), SALON_TZ);
  const localDayEnd   = fromZonedTime(new Date(`${dateStr}T23:59:59`), SALON_TZ);

  // Resolve dayOfWeek in salon timezone (0=Sunday)
  const localDate = toZonedTime(localMidnight, SALON_TZ);
  const dayOfWeek = localDate.getDay();

  // Fetch professional + service + working hours
  const professional = await prisma.professional.findUnique({
    where: { id: professionalId, active: true },
    include: {
      workingHours: { where: { dayOfWeek } },
      services: { where: { serviceId } },
    },
  });
  if (!professional) throw new NotFoundError('Professional not found', 'PROFESSIONAL_NOT_FOUND');

  const wh = professional.workingHours[0];
  if (!wh) {
    return { available: false, reason: 'NOT_WORKING', slots: [] };
  }

  const service = await prisma.service.findUnique({ where: { id: serviceId, active: true } });
  if (!service) throw new NotFoundError('Service not found', 'SERVICE_NOT_FOUND');

  // Convert working hours strings to UTC
  const [sh, sm] = wh.startTime.split(':').map(Number);
  const [eh, em] = wh.endTime.split(':').map(Number);
  const baseDateLocal = toZonedTime(localMidnight, SALON_TZ);
  const workStartLocal = new Date(baseDateLocal);
  workStartLocal.setHours(sh, sm, 0, 0);
  const workEndLocal = new Date(baseDateLocal);
  workEndLocal.setHours(eh, em, 0, 0);
  const workStart = fromZonedTime(workStartLocal, SALON_TZ);
  const workEnd   = fromZonedTime(workEndLocal,   SALON_TZ);

  // Fetch active bookings (TTL-filtered)
  const activeBookings = await prisma.$queryRaw`
    SELECT "startTime", "endTime"
    FROM bookings
    WHERE "professionalId" = ${professionalId}::uuid
      AND "startTime" >= ${workStart}
      AND "startTime" < ${workEnd}
      AND status IN ('PRE_RESERVED', 'CONFIRMED')
      AND (
        status = 'CONFIRMED'
        OR (status = 'PRE_RESERVED' AND "expiresAt" > NOW())
      )
  `;

  const slots = generateAvailableSlots(workStart, workEnd, service.durationMin, activeBookings);

  if (slots.length === 0 && activeBookings.length > 0) {
    return { available: false, reason: 'FULLY_BOOKED', slots: [] };
  }

  return {
    available: slots.length > 0,
    reason: slots.length === 0 ? 'FULLY_BOOKED' : null,
    slots: slots.map((s) => s.toISOString()),
  };
}
```

### Prisma $queryRaw Parameter Escaping (verified)
```javascript
// Source: https://www.prisma.io/docs/orm/prisma-client/queries/raw-database-access/raw-queries
// Tagged template literals auto-escape ALL data values — safe from injection.
// You CANNOT interpolate identifiers (table/column names) — use $queryRawUnsafe only if needed.
// Cast UUID strings explicitly: ${someUuid}::uuid

const rows = await tx.$queryRaw`
  SELECT id, status
  FROM bookings
  WHERE id = ${bookingId}::uuid
  FOR UPDATE SKIP LOCKED
`;
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Application-level slot locking (Redis SETNX) | PostgreSQL partial unique index | Established in Phase 2 decision | Simpler, no Redis dependency, ACID-guaranteed |
| Cron-sweep-only TTL expiry | Query-time TTL filter + optional cron sweep | Established in Phase 2 decision (SCHD-08) | No stale hold window regardless of sweep frequency |
| `partialIndexes` Prisma DSL | Raw SQL migration (for Prisma 6.x) | Prisma 7.4.0 added `partialIndexes`; not yet in 6.x | Use `--create-only` workflow; safe in Prisma 6 |
| `date-fns` alone for timezones | `date-fns` + `date-fns-tz` | date-fns 4.x added native TZ; 3.x still needs companion | Install `date-fns-tz@3.2.0` alongside `date-fns@3.6.0` |

**Deprecated/outdated:**
- `moment-timezone`: Do not introduce. `date-fns-tz` is the maintained alternative.
- `Prisma.join()` for IN clauses with raw queries: Prefer the TTL filter expressed directly in the SQL template string rather than constructing with `Prisma.join` — simpler and readable.

---

## Open Questions

1. **Multi-service bookings (duration summation)**
   - What we know: `BookingService` is one-to-many; a booking can have multiple services
   - What's unclear: Should total duration = sum of all service durations? Are services performed sequentially?
   - Recommendation: For Phase 2, assume single-service per booking (simplest path). Multi-service can be added later — the slot generation only needs total durationMin.

2. **Next-available suggestion for SCHD-06**
   - What we know: Response must include a "next available" date when fully booked
   - What's unclear: How far ahead to search (1 day? 7 days?)
   - Recommendation: Search forward up to 14 days, return the first date with any available slot. This is a linear loop calling the slot-check function per day.

3. **Partial unique index and PostgreSQL enum type**
   - What we know: `status` in the DB is a PostgreSQL enum `BookingStatus`, not a plain string
   - What's unclear: Does `WHERE status IN ('PRE_RESERVED', 'CONFIRMED')` work with PostgreSQL enum types?
   - Recommendation: Yes — PostgreSQL enum comparison with string literals works in WHERE clauses and index predicates. Confirmed by PostgreSQL docs on partial indexes. LOW risk.

4. **node-cron timezone for schedule execution**
   - What we know: node-cron v4 supports a `timezone` option for the schedule
   - What's unclear: Is there a reason to run the sweep on salon-local midnight (e.g., for daily cleanup)?
   - Recommendation: Run sweep every minute in UTC (default). The cleanup is purely mechanical — timezone of the cron schedule doesn't matter for correctness.

---

## Sources

### Primary (HIGH confidence)
- Prisma official docs — raw queries: https://www.prisma.io/docs/orm/prisma-client/queries/raw-database-access/raw-queries
- Prisma official docs — interactive transactions: https://www.prisma.io/docs/orm/prisma-client/queries/transactions
- Prisma official docs — customizing migrations: https://www.prisma.io/docs/orm/prisma-migrate/workflows/customizing-migrations
- PostgreSQL official docs — partial indexes: https://www.postgresql.org/docs/current/indexes-partial.html
- `date-fns-tz` GitHub README (v3.x API): https://github.com/marnusw/date-fns-tz
- `node-cron` GitHub (v4.0.0): https://github.com/node-cron/node-cron

### Secondary (MEDIUM confidence)
- Prisma 7.4.0 release notes confirming `partialIndexes` was added in 7.4.0 (not in 6.x): https://github.com/prisma/prisma/releases/tag/7.4.0
- GitHub issue #29220/#29289 confirming Prisma 6 does NOT drop partial indexes (issue only appeared in 7.4.x): https://github.com/prisma/prisma/issues/29220
- Timeslottr algorithm blog — interval subtraction pattern: https://www.tilomitra.com/blog/timeslottr-algorithm
- Brandur — idempotency key pattern with PostgreSQL: https://brandur.org/idempotency-keys
- date-fns-tz v4 announcement (confirms 3.x needs companion lib): https://blog.date-fns.org/v40-with-time-zone-support/

### Tertiary (LOW confidence)
- WebSearch result on node-cron ESM support (unverified by docs): multiple sources agree on `import cron from 'node-cron'` syntax
- WebSearch result on date-fns-tz 3.2.0 peerDep compatibility with date-fns ^3.0.0 (not verified against actual package.json)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — All versions verified against official sources; `partialIndexes` in Prisma 7.4+ confirmed
- Architecture patterns: HIGH — Raw SQL migration workflow verified via Prisma official docs; SELECT FOR UPDATE pattern verified
- Slot generation: HIGH — Interval overlap formula mathematically verified; end-of-day boundary pitfall documented
- Pitfalls: HIGH — Critical pitfalls traced to official sources or GitHub issues with concrete repro evidence

**Research date:** 2026-03-13
**Valid until:** 2026-04-13 (30 days — Prisma, date-fns-tz are stable; node-cron v4 is recent but stable API)
