# Phase 3: Payment Engine - Research

**Researched:** 2026-03-13
**Domain:** Simulated PIX payment model, Prisma schema extension, Express route patterns
**Confidence:** HIGH (primary findings drawn from direct codebase inspection and established project patterns)

---

## Summary

Phase 3 adds a simulated PIX payment engine on top of the existing booking model. No real payment gateway is involved. The work is primarily: (1) add a `Payment` Prisma model with a status enum and a foreign key to `Booking`, (2) generate a fake PIX QR payload on intent creation, (3) expose three endpoints matching requirements PYMT-01, PYMT-02, PYMT-03.

The entire codebase pattern is already established and highly consistent. The payment module will follow exactly the same conventions: camelCase DB column names (no `@map`), `prisma migrate dev` workflow, `asyncHandler` wrapper, `apiKeyAuth` per-router, `validate()` middleware with Zod, `NotFoundError`/`ConflictError` from `src/lib/errors.js`, and `{ data: ... }` JSON envelopes. No new dependencies are needed.

The price snapshot does NOT need to be re-calculated at payment time. `BookingService.price` already stores the snapshotted price per service. The payment intent endpoint reads the booking's `BookingService` rows, sums their `price` fields, and stores that total in the `Payment.amount` field.

**Primary recommendation:** Model `Payment` as a one-to-one relationship with `Booking` (one active payment per booking). Enforce this with a `@@unique([bookingId])` constraint in the Prisma schema (or alternatively allow only one non-CANCELLED payment per booking at the application layer — simpler for this phase). For Phase 3's simulated scope, enforce uniqueness by checking for an existing payment before creating.

---

## Standard Stack

### Core (already in project — no new installs needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@prisma/client` | 6.19.2 | Payment model ORM + migration | Already established throughout |
| `zod` | 3.25.76 | Input validation on endpoints | Already established via `validate()` middleware |
| `express` | 4.22.1 | HTTP routing | Already established |
| `uuid` | 11.1.0 | UUID generation (already in package.json) | Already installed; use for PIX `txid` generation |

### Not Needed

- Any real PIX SDK (e.g., `efipay`, `gerencianet`): this is simulated — QR payload is constructed inline
- `stripe`, `mercadopago`, or any other payment library: out of scope
- Redis or any queue: no async webhooks to handle
- `crypto` for QR generation: a simple UUID-based fake payload is sufficient

### Installation

No new packages required. All needed libraries are already installed.

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── routes/
│   └── payments.js          # PYMT-01, PYMT-02, PYMT-03 endpoints
├── services/
│   └── paymentService.js    # createPixIntent, getPaymentStatus, simulatePaid
└── (no new lib/ or jobs/ needed)
prisma/
└── schema.prisma            # Add PaymentStatus enum + Payment model
```

### Pattern 1: Prisma Schema Extension (Payment model)

**What:** Add `PaymentStatus` enum and `Payment` model to `schema.prisma`.

**Column naming convention (CRITICAL):** This project uses camelCase column names in PostgreSQL because it was initially seeded via `prisma db push` without `@map`. All subsequent migrations (Phase 2 index) also use camelCase column names (`"professionalId"`, `"startTime"`, etc.). Confirmed by inspecting `prisma/migrations/20260313220717_add_booking_conflict_index/migration.sql`. New models MUST NOT use `@map` — continue the established pattern.

**Schema to add:**

```prisma
enum PaymentStatus {
  PENDING
  PAID
  CANCELLED
}

model Payment {
  id        String        @id @default(uuid()) @db.Uuid
  bookingId String        @unique @db.Uuid
  amount    Decimal       @db.Decimal(10, 2)
  status    PaymentStatus @default(PENDING)
  pixPayload String       @db.Text
  createdAt DateTime      @default(now()) @db.Timestamptz
  updatedAt DateTime      @updatedAt @db.Timestamptz

  booking Booking @relation(fields: [bookingId], references: [id])

  @@map("payments")
}
```

**Important:** Add the reverse relation to the `Booking` model:

```prisma
model Booking {
  // ... existing fields ...
  payment Payment?
}
```

**`bookingId @unique`:** Enforces one-payment-per-booking at the DB level. A second `POST /api/payments/pix` for the same booking will throw `P2002`, which the service layer catches and surfaces as `ConflictError`.

**Migration workflow:**

```bash
# 1. Edit prisma/schema.prisma (add enum + model + reverse relation)
# 2. Run migration
npx prisma migrate dev --name add_payment_model
# 3. Prisma auto-generates the DDL — no raw SQL needed for this migration
```

### Pattern 2: Route + Service Structure

Follows the exact same pattern as `src/routes/bookings.js` and `src/services/bookingService.js`.

**Route file (`src/routes/payments.js`):**

```javascript
import { Router } from 'express';
import { z } from 'zod';
import { apiKeyAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  createPixIntent,
  getPaymentStatus,
  simulatePaid,
} from '../services/paymentService.js';

const router = Router();
router.use(apiKeyAuth);

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// PYMT-01 — create PIX payment intent for a booking
router.post('/pix',
  validate({
    body: z.object({
      bookingId: z.string().uuid(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const payment = await createPixIntent(req.body.bookingId);
    res.status(201).json({ data: payment });
  })
);

// PYMT-02 — get payment status
router.get('/:id/status',
  validate({
    params: z.object({ id: z.string().uuid() }),
  }),
  asyncHandler(async (req, res) => {
    const payment = await getPaymentStatus(req.params.id);
    res.json({ data: payment });
  })
);

// PYMT-03 — simulate payment confirmation (dev/test)
router.post('/:id/simulate-paid',
  validate({
    params: z.object({ id: z.string().uuid() }),
  }),
  asyncHandler(async (req, res) => {
    const payment = await simulatePaid(req.params.id);
    res.json({ data: payment });
  })
);

export default router;
```

**Register in `src/app.js`:**

```javascript
import paymentsRouter from './routes/payments.js';
// ...
app.use('/api/payments', paymentsRouter);
```

### Pattern 3: PIX Payload Simulation

**What:** For testing purposes, a fake PIX payload is generated. Real PIX uses EMV QR Code standard (PIX Copia e Cola format). For simulation, a UUID-based string is sufficient — agents only need to receive a string and store/return it.

**Simulated payload format:**

```javascript
import { v4 as uuidv4 } from 'uuid';

function generatePixPayload(bookingId, amount) {
  // Simulated PIX payload — not a valid EMV QR string
  // Format is arbitrary; just needs to be a stable identifier
  const txid = uuidv4().replace(/-/g, '').toUpperCase();
  return `PIX-SIM:txid=${txid}:booking=${bookingId}:amount=${amount}`;
}
```

**Alternative (also acceptable):** Simply return the `txid` as the payload. The success criterion only requires "a simulated PIX QR code payload" — any non-empty string qualifies.

### Pattern 4: Amount Calculation from Booking

**What:** Sum `BookingService.price` for the booking to get the payment amount. Do NOT use `Service.price` (which could change after booking). `BookingService.price` is the snapshotted value.

```javascript
// Inside createPixIntent service function
const booking = await prisma.booking.findUnique({
  where: { id: bookingId },
  include: {
    services: true,       // BookingService rows (has .price field)
    payment: true,        // check for existing payment
  },
});

if (!booking) {
  throw new NotFoundError('Booking not found', 'BOOKING_NOT_FOUND');
}

if (booking.status !== 'CONFIRMED') {
  throw new ValidationError(
    'Payment can only be created for confirmed bookings',
    null,
    'BOOKING_NOT_CONFIRMED'
  );
}

if (booking.payment) {
  throw new ConflictError('Payment already exists for this booking', 'PAYMENT_ALREADY_EXISTS');
}

// Sum snapshotted prices (Decimal type from Prisma — convert to number for arithmetic)
const amount = booking.services.reduce(
  (sum, bs) => sum + parseFloat(bs.price),
  0
);
```

**Note on Prisma `Decimal` type:** Prisma returns `Decimal` objects (from the `decimal.js` library internally) for `@db.Decimal` fields. When summing, use `parseFloat(bs.price)` or `Number(bs.price)`. Storing back to Prisma accepts JavaScript numbers or strings — Prisma converts them.

### Pattern 5: Status Transition Logic (simulate-paid)

**What:** `POST /api/payments/:id/simulate-paid` sets status to PAID only if currently PENDING.

```javascript
export async function simulatePaid(paymentId) {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
  });

  if (!payment) {
    throw new NotFoundError('Payment not found', 'PAYMENT_NOT_FOUND');
  }

  if (payment.status !== 'PENDING') {
    throw new ConflictError(
      `Cannot mark payment as paid from status ${payment.status}`,
      'INVALID_STATUS_TRANSITION'
    );
  }

  return prisma.payment.update({
    where: { id: paymentId },
    data: { status: 'PAID' },
  });
}
```

**No transaction needed:** Unlike bookings, payments don't have concurrent mutation risk in Phase 3 (simulated, single-path). A simple findUnique + update is sufficient. If concurrent simulation calls are a concern, use `prisma.$transaction` with `FOR UPDATE SKIP LOCKED` (same pattern as booking confirmation) — but that's over-engineering for a dev/test endpoint.

### Pattern 6: Error Handling

Follow established patterns exactly:

| Condition | Error Class | Code |
|-----------|-------------|------|
| Booking not found | `NotFoundError` | `BOOKING_NOT_FOUND` |
| Payment not found | `NotFoundError` | `PAYMENT_NOT_FOUND` |
| Booking not CONFIRMED | `ValidationError` | `BOOKING_NOT_CONFIRMED` |
| Payment already exists | `ConflictError` | `PAYMENT_ALREADY_EXISTS` |
| Invalid status transition | `ConflictError` | `INVALID_STATUS_TRANSITION` |
| P2002 from DB (duplicate bookingId) | Caught, re-thrown as `ConflictError` | `PAYMENT_ALREADY_EXISTS` |

**P2002 handling in createPixIntent:**

```javascript
try {
  return await prisma.payment.create({ ... });
} catch (err) {
  if (err.code === 'P2002') {
    throw new ConflictError('Payment already exists for this booking', 'PAYMENT_ALREADY_EXISTS');
  }
  throw err;
}
```

The global `errorHandler` already handles P2002 as a generic 409 CONFLICT — but catching it in the service layer gives a more specific error code.

### Anti-Patterns to Avoid

- **Re-querying `Service.price` at payment time:** Never use `Service.price` to calculate the payment amount. Use `BookingService.price` (the snapshot taken at booking time). The service price may have changed.
- **Allowing payments for non-CONFIRMED bookings:** A PRE_RESERVED booking has not been confirmed by the client. A CANCELLED booking should not be payable. Validate `booking.status === 'CONFIRMED'` before creating a payment intent.
- **Allowing multiple payments per booking:** The `bookingId @unique` constraint enforces one-to-one. Also do an application-level check (include `payment` in the booking query) to give a clear error message before hitting the DB constraint.
- **Using `asyncHandler` without `router.use(apiKeyAuth)`:** Every endpoint must be behind API key auth. Apply `router.use(apiKeyAuth)` at the router level (same as bookings.js line 14).
- **Returning `pixPayload` only on creation:** The `GET /api/payments/:id/status` endpoint should return the full payment object including `pixPayload` so the agent can re-fetch the QR code if needed.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Unique payment per booking | Application-only check | `bookingId @unique` in Prisma schema | DB constraint is race-safe; application check alone has a race window |
| UUID generation for txid | Custom random string | `uuid` package (already installed) | Already a dependency; produces valid UUIDs |
| Amount from booking | Re-querying Service.price | `BookingService.price` (already snapshotted) | Price snapshot is the purpose of BookingService.price; re-querying would use current price, not booking-time price |
| Error handling | Custom try/catch per route | `asyncHandler` pattern + `errorHandler` middleware | Already established; don't bypass it |
| Validation | Manual req.body checks | `validate()` middleware with Zod | Already established; consistent error format |

**Key insight:** This phase is mostly wiring existing patterns together. The "new" code is the Payment Prisma model and the PIX payload generation (which is trivial). The patterns for routing, validation, error handling, and DB operations are already battle-tested in this codebase.

---

## Common Pitfalls

### Pitfall 1: Decimal Arithmetic Losing Precision

**What goes wrong:** `parseFloat(booking.services[0].price)` on a value like `79.90` may produce `79.90000000000001` due to IEEE 754 floating point.

**Why it happens:** Prisma's `Decimal` type is exact, but JavaScript `parseFloat` converts to a binary float.

**How to avoid:** For a simulated engine, floating-point drift in the string representation is cosmetic. Two options:
- Use `Number(bs.price).toFixed(2)` to round back to 2 decimal places before storing
- Use `bs.price.toString()` and pass the string directly to Prisma's `Decimal` field — Prisma accepts strings for Decimal columns

**Recommended:** Sum using the Decimal object's own arithmetic if precision matters. Alternatively, store `Number(total).toFixed(2)` as a string — Prisma accepts it.

**Warning signs:** Payment `amount` stored as `159.90000000000002` instead of `159.90`.

### Pitfall 2: Missing Reverse Relation on Booking Model

**What goes wrong:** Adding `Payment` model without updating `Booking` model with `payment Payment?` causes a Prisma schema validation error: `Error validating: A one-to-one relation must have exactly one @unique attribute on one of the model fields.`

**Why it happens:** Prisma requires both sides of a relation to be declared when using interactive queries (e.g., `include: { payment: true }` on a booking query).

**How to avoid:** Always add `payment Payment?` to the `Booking` model when adding the `Payment` model.

**Warning signs:** `prisma migrate dev` fails with relation validation error.

### Pitfall 3: Route Registration Order in app.js

**What goes wrong:** `GET /api/payments/:id/status` conflicts if the payments router is registered after another router that captures the same path pattern.

**Why it happens:** Express route matching is first-match. If `/api/payments` isn't registered, or if the wildcard in another router matches first, requests are misrouted.

**How to avoid:** Register `app.use('/api/payments', paymentsRouter)` as a distinct prefix in `app.js`. The existing routers (`/api/bookings`, `/api/clients`, etc.) all use distinct prefixes — no conflict.

**Warning signs:** Payment endpoints return 404 despite route definition being correct.

### Pitfall 4: Querying bookingId for Duplicate Check vs DB Constraint

**What goes wrong:** Application checks `booking.payment` (from the `include`) to detect existing payment. But between the check and the `prisma.payment.create`, another concurrent request could sneak in. The application check then says "no payment exists" but the DB constraint fires.

**Why it happens:** TOCTOU (check-then-act) race between the findUnique+include and the create.

**How to avoid:** Always wrap the create in a try/catch for `P2002`. The application-level check is for UX (better error message); the DB constraint is the actual enforcement. Both are needed.

**Warning signs:** Occasional 500 errors with `Unique constraint failed on the fields: ('bookingId')` instead of a clean 409.

### Pitfall 5: camelCase Column Names in Raw SQL (if any raw queries are needed)

**What goes wrong:** If a developer writes a raw SQL query and uses `booking_id` instead of `"bookingId"`, PostgreSQL throws `column "booking_id" does not exist`.

**Why it happens:** This project does NOT use `@map` — Prisma created the DB columns using the camelCase field names directly. This is confirmed by the migration SQL where columns are `"bookingId"`, `"startTime"`, `"professionalId"` etc.

**How to avoid:** In any raw SQL for the payments table, always quote camelCase column names: `"bookingId"`, `"pixPayload"`, `"createdAt"`, `"updatedAt"`. This is the established pattern in `bookingService.js`.

**Warning signs:** `column "booking_id" does not exist` PostgreSQL error.

**Note:** For Phase 3, no raw SQL is expected to be needed — all payment operations use Prisma ORM methods (`create`, `findUnique`, `update`). Raw SQL is only needed when Prisma ORM can't express the query (e.g., `FOR UPDATE SKIP LOCKED`, partial indexes).

---

## Code Examples

### Full createPixIntent Service Function

```javascript
// src/services/paymentService.js
import { v4 as uuidv4 } from 'uuid';
import prisma from '../lib/prisma.js';
import { NotFoundError, ValidationError, ConflictError } from '../lib/errors.js';

function generatePixPayload(bookingId, amount) {
  const txid = uuidv4().replace(/-/g, '').toUpperCase();
  return `PIX-SIM:txid=${txid}:booking=${bookingId}:amount=${Number(amount).toFixed(2)}`;
}

export async function createPixIntent(bookingId) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      services: true,   // BookingService rows — has .price field (snapshotted)
      payment: true,    // existing payment, if any
    },
  });

  if (!booking) {
    throw new NotFoundError('Booking not found', 'BOOKING_NOT_FOUND');
  }

  if (booking.status !== 'CONFIRMED') {
    throw new ValidationError(
      'Payment intent can only be created for CONFIRMED bookings',
      null,
      'BOOKING_NOT_CONFIRMED'
    );
  }

  if (booking.payment) {
    throw new ConflictError(
      'Payment already exists for this booking',
      'PAYMENT_ALREADY_EXISTS'
    );
  }

  // Sum snapshotted prices from BookingService rows
  const total = booking.services.reduce(
    (sum, bs) => sum + parseFloat(bs.price),
    0
  );
  const amount = Number(total).toFixed(2); // "159.90" — string, Prisma accepts for Decimal

  const pixPayload = generatePixPayload(bookingId, amount);

  try {
    return await prisma.payment.create({
      data: {
        bookingId,
        amount,
        status: 'PENDING',
        pixPayload,
      },
    });
  } catch (err) {
    if (err.code === 'P2002') {
      throw new ConflictError(
        'Payment already exists for this booking',
        'PAYMENT_ALREADY_EXISTS'
      );
    }
    throw err;
  }
}

export async function getPaymentStatus(paymentId) {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
  });

  if (!payment) {
    throw new NotFoundError('Payment not found', 'PAYMENT_NOT_FOUND');
  }

  return payment;
}

export async function simulatePaid(paymentId) {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
  });

  if (!payment) {
    throw new NotFoundError('Payment not found', 'PAYMENT_NOT_FOUND');
  }

  if (payment.status !== 'PENDING') {
    throw new ConflictError(
      `Cannot simulate payment in status ${payment.status}`,
      'INVALID_STATUS_TRANSITION'
    );
  }

  return prisma.payment.update({
    where: { id: paymentId },
    data: { status: 'PAID' },
  });
}
```

### Prisma Schema Addition (complete diff)

```prisma
// Add before model AdminUser:

enum PaymentStatus {
  PENDING
  PAID
  CANCELLED
}

model Payment {
  id         String        @id @default(uuid()) @db.Uuid
  bookingId  String        @unique @db.Uuid
  amount     Decimal       @db.Decimal(10, 2)
  status     PaymentStatus @default(PENDING)
  pixPayload String        @db.Text
  createdAt  DateTime      @default(now()) @db.Timestamptz
  updatedAt  DateTime      @updatedAt @db.Timestamptz

  booking Booking @relation(fields: [bookingId], references: [id])

  @@map("payments")
}

// Modify model Booking — add payment relation field:
// payment Payment?
```

### app.js Registration

```javascript
// Add import:
import paymentsRouter from './routes/payments.js';

// Add route (after bookingsRouter registration):
// Payment engine — PYMT-01 through PYMT-03
app.use('/api/payments', paymentsRouter);
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Real PIX gateway integration | Simulated payload string | Phase 3 decision | No external dependency; trivially testable |
| Storing live price at payment time | Price snapshot in BookingService.price | Phase 2 decision | Deterministic pricing; Phase 3 just reads the snapshot |

**Deprecated/outdated:**
- Nothing deprecated in this phase. All patterns extend existing Phase 1+2 conventions.

---

## Open Questions

1. **CANCELLED payment status — when is it used?**
   - What we know: The `PaymentStatus` enum includes `CANCELLED` per PYMT-02 (check status returns PENDING/PAID/CANCELLED)
   - What's unclear: No requirement specifies when a payment becomes CANCELLED. Is it when the booking is cancelled? Is there a `simulate-cancelled` endpoint?
   - Recommendation: Declare the enum value but do not wire any transition logic to CANCELLED in Phase 3. If a booking cancellation should cascade, that is a separate feature. The status endpoint can return CANCELLED if manually set in the DB.

2. **Should `simulate-paid` also be accessible via `apiKeyAuth` (agent) or restricted to admin?**
   - What we know: PYMT-03 says "a developer calling" — suggesting dev/test usage, not agent usage
   - What's unclear: No explicit auth distinction in the requirements
   - Recommendation: Use `apiKeyAuth` consistently (same as all other endpoints in this project). If admin-only restriction is needed later, it can be swapped to `adminAuth`. For Phase 3, use `apiKeyAuth` to keep the test surface minimal.

3. **Should `POST /api/payments/pix` return the full payment object or just the pixPayload?**
   - What we know: Success criterion 1 requires "a payment record with status PENDING" to be returned
   - What's unclear: Whether `pixPayload` should be at the top level or nested
   - Recommendation: Return the full `Payment` record from Prisma in `{ data: payment }` — consistent with all other endpoints in the project. The record includes `id`, `bookingId`, `amount`, `status`, `pixPayload`, `createdAt`, `updatedAt`.

---

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection:
  - `prisma/schema.prisma` — existing model structure, enum pattern, column naming
  - `prisma/migrations/20260313000000_baseline/migration.sql` — confirms camelCase column names in DB
  - `prisma/migrations/20260313220717_add_booking_conflict_index/migration.sql` — confirms camelCase in raw SQL
  - `src/routes/bookings.js` — asyncHandler, apiKeyAuth, validate middleware patterns
  - `src/services/bookingService.js` — Prisma usage, P2002 handling, error class usage
  - `src/middleware/errorHandler.js` — global error handler, AppError/P2002 handling
  - `src/middleware/auth.js` — apiKeyAuth pattern
  - `src/middleware/validate.js` — Zod validation middleware
  - `src/lib/errors.js` — error class hierarchy
  - `src/app.js` — router registration pattern
  - `package.json` — confirms `uuid` v11 already installed

### Secondary (MEDIUM confidence)
- Prisma official docs on Decimal type: Prisma accepts strings and numbers for `Decimal` columns; returns `Decimal` objects
- Prisma official docs on one-to-one relations: both sides must be declared; `@unique` on the FK side enforces one-to-one

### Tertiary (LOW confidence)
- IEEE 754 floating-point precision for summing Decimal values via parseFloat — standard JavaScript behavior, not library-specific

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — confirmed by package.json inspection; no new dependencies required
- Architecture patterns: HIGH — derived directly from existing bookings.js/bookingService.js which are working, tested code
- Payment model schema: HIGH — follows identical pattern to existing Prisma models; camelCase naming confirmed by migration SQL
- PIX simulation: HIGH — trivially simple; no real PIX SDK involved
- Pitfalls: HIGH — derived from direct code inspection of existing patterns; Decimal pitfall is well-known JavaScript behavior

**Research date:** 2026-03-13
**Valid until:** 2026-04-13 (30 days — stable stack, no fast-moving dependencies introduced)
