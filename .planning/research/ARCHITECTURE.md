# Architecture Research — AI Scheduling Platform

## Component Boundaries

The platform has 5 well-defined components/domains:

### 1. Identity & Clients
- **Responsibility:** Client records (name, phone, email), AI agent authentication (API key validation)
- **Exposes:** Client CRUD, lookup by phone, client history
- **Depends on:** Nothing (foundational)
- **Data:** `Client` table

### 2. Services Catalog
- **Responsibility:** Service definitions (name, duration, price), professional profiles, service-to-professional assignments
- **Exposes:** Service listing, professional listing, service availability by professional
- **Depends on:** Nothing (foundational, parallel to Identity)
- **Data:** `Service`, `Professional`, `ProfessionalService` (join) tables

### 3. Scheduling Engine (Core)
- **Responsibility:** Slot generation from working hours, availability queries, pre-reservation with TTL, booking creation with conflict detection, booking lifecycle (confirm/cancel)
- **Exposes:** Slot query, pre-reserve, confirm, cancel, booking lookup
- **Depends on:** Services Catalog (duration for slot calculation), Identity (client for booking)
- **Data:** `WorkingHours`, `Booking` (with status enum: PRE_RESERVED, CONFIRMED, CANCELLED, COMPLETED, NO_SHOW)

### 4. Payment Engine
- **Responsibility:** Payment intent creation (PIX simulation), status tracking, webhook ingestion for payment confirmation
- **Exposes:** Create payment, check status, payment webhook receiver
- **Depends on:** Scheduling Engine (booking reference)
- **Data:** `Payment` table (linked to Booking)

### 5. Conversation Tracking
- **Responsibility:** Links OrchestratorAI conversation sessions to bookings, audit trail
- **Exposes:** Link conversation to booking, query bookings by conversation
- **Depends on:** Scheduling Engine (booking reference)
- **Data:** `ConversationLink` table (conversationId, bookingId, agentId, timestamps)

---

## Data Flow — Primary Booking Flow

The complete booking flow from AI agent perspective (8 steps):

```
AI Agent (via OrchestratorAI capability)
  │
  1. GET /api/clients/by-phone/:phone
  │   └── Returns client or 404
  │
  2. POST /api/clients (if new)
  │   └── Creates client, returns client object
  │
  3. GET /api/services
  │   └── Returns available services with duration/price
  │
  4. GET /api/schedule/slots?date=X&serviceId=Y&professionalId=Z
  │   └── Returns available time slots (generated, not stored)
  │
  5. POST /api/bookings/pre-reserve
  │   └── Creates PRE_RESERVED booking with TTL (5 min)
  │   └── Atomically checks conflict (DB-level unique constraint)
  │
  6. POST /api/payments/pix
  │   └── Creates payment intent, returns PIX data
  │
  7. POST /api/bookings/:id/confirm
  │   └── Moves booking PRE_RESERVED → CONFIRMED
  │   └── Links payment record
  │
  8. Conversation tracking (automatic)
  │   └── conversationId stored on booking at creation
```

---

## Critical Architecture Patterns

### Slot Generation (Calculated, Not Stored)

**Do NOT store slots as rows in the database.** Slots are calculated at query time:

```
Available Slots = Working Hours
                  - Existing Bookings (CONFIRMED + PRE_RESERVED)
                  - Buffer Time
```

Working hours are stored as recurring weekly rules:
```
Professional X: Monday 09:00-18:00, Tuesday 09:00-18:00, ...
```

Slot query algorithm:
1. Get working hours for professional on requested date
2. Get existing bookings (CONFIRMED + PRE_RESERVED where TTL not expired)
3. Subtract booked windows (booking start → booking start + service duration + buffer)
4. Return remaining windows sliced by requested service duration

**Why:** Storing slots creates millions of rows, requires cleanup jobs, and causes synchronization nightmares.

### Pre-Reservation with TTL

Pre-reservation prevents "slot stolen between check and confirm" race condition:

```sql
-- Booking table has partial unique index:
CREATE UNIQUE INDEX booking_slot_conflict
  ON bookings (professional_id, start_time)
  WHERE status IN ('PRE_RESERVED', 'CONFIRMED');
```

- Pre-reservation has a `expiresAt` timestamp (e.g., 5 minutes from creation)
- Background job or query-time check expires stale pre-reservations
- Conflict detection happens at DB level (unique index), not application level

**Why DB-level, not app-level:** Application-level locking fails on restart, multi-process, or multi-instance deployments. PostgreSQL partial unique index is atomic and reliable.

### Idempotent Endpoints

AI agents may retry on timeout. Critical mutations must be idempotent:

- `POST /api/bookings/pre-reserve` accepts optional `idempotencyKey`
- If same key exists and booking is still valid, return existing booking
- Prevents double-booking on retry

### Payment Flow (Webhook-Driven)

Payment confirmation is asynchronous:
1. Agent calls `POST /api/payments/pix` → returns PIX data + payment ID
2. Client pays externally (or simulated in MVP)
3. Payment webhook updates payment status → PAID
4. Agent calls `POST /api/bookings/:id/confirm` with paymentId

**For MVP:** Payment is simulated — `POST /api/payments/pix` creates a PENDING payment. A separate endpoint `POST /api/payments/:id/simulate-payment` marks it as PAID (dev/test only).

---

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Correct Approach |
|---|---|---|
| Storing slots as DB rows | Millions of rows, sync nightmares, cleanup jobs | Calculate slots at query time from working hours |
| In-memory application locking | Fails on restart, multi-process | PostgreSQL partial unique index for conflict detection |
| Synchronous payment confirmation | Blocks AI conversation, fragile | Webhook-driven async payment, polling status |
| Coupling conversation tracking to booking critical path | If tracking fails, booking fails | Store conversationId on booking, but tracking failures don't block booking |
| Fat controllers without service layer | Untestable, unmaintainable | Controller → Service → Repository pattern |

---

## Recommended Project Structure

```
Service-schedule/
├── prisma/
│   ├── schema.prisma          # All models
│   └── seed.js                # Seed data (services, professionals, working hours)
├── src/
│   ├── app.js                 # Express app setup, middleware
│   ├── server.js              # Server entry point
│   ├── middleware/
│   │   ├── auth.js            # API key validation
│   │   ├── errorHandler.js    # Global error handler
│   │   └── validate.js        # Request validation (Zod)
│   ├── routes/
│   │   ├── clients.js
│   │   ├── services.js
│   │   ├── schedule.js
│   │   ├── bookings.js
│   │   ├── payments.js
│   │   └── health.js
│   ├── services/              # Business logic
│   │   ├── clientService.js
│   │   ├── serviceService.js
│   │   ├── scheduleService.js # Slot generation algorithm
│   │   ├── bookingService.js  # Pre-reserve, confirm, cancel
│   │   └── paymentService.js
│   └── lib/
│       ├── prisma.js          # Prisma client singleton
│       ├── errors.js          # Custom error classes
│       └── slots.js           # Slot calculation helpers
├── package.json
└── .env
```

---

## Suggested Build Order

Based on dependency analysis:

| Phase | What | Why This Order |
|-------|------|----------------|
| **Phase 1: Foundation + Identity + Catalog** | Project setup, Express app, Prisma schema, Client CRUD, Service CRUD, Professional CRUD | No dependencies — builds the foundation all other domains need |
| **Phase 2: Scheduling Engine** | Working hours config, slot generation algorithm, pre-reservation with TTL, booking confirm/cancel, conflict detection | Depends on Services (duration) and Identity (client) from Phase 1 |
| **Phase 3: Payment Engine** | Payment creation (PIX simulation), status tracking, simulate-payment endpoint | Depends on Booking from Phase 2 |
| **Phase 4: Conversation Tracking + Integration** | ConversationId linkage, booking-by-conversation query, API key auth, error standardization | Depends on Booking from Phase 2; cross-cutting concerns |

**Critical path:** Phase 1 → Phase 2 is the bottleneck. Phase 3 and Phase 4 can potentially run in parallel after Phase 2.

---

## Confidence Assessment

| Area | Confidence | Basis |
|------|------------|-------|
| Component boundaries | HIGH | Standard domain-driven design for scheduling systems |
| Slot generation (calculated) | HIGH | Industry best practice; stored slots is a known anti-pattern |
| Pre-reservation with TTL | HIGH | Standard pattern in booking systems (hotel, flight, salon) |
| PostgreSQL partial unique index | HIGH | Well-documented PostgreSQL feature for conflict detection |
| Build order | HIGH | Clear dependency chain between domains |
| Payment flow | MEDIUM | Simulated for MVP; real PIX integration patterns may differ |

---
*Research completed: 2026-03-13*
