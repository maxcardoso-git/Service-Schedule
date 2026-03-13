# Project Research Summary

**Project:** AI Scheduling Platform (Service-schedule)
**Domain:** Appointment Booking API for AI Agent Consumption
**Researched:** 2026-03-13
**Confidence:** HIGH

## Executive Summary

This is a REST API backend that enables OrchestratorAI agents to book, manage, and track appointments at a beauty salon. The platform is not a general-purpose SaaS scheduling tool — it is a structured data service consumed by AI agents via HTTP. Research across all four domains converges on the same architectural conclusion: build a lean, conflict-safe scheduling engine with a PostgreSQL-first approach, expose well-formed endpoints that AI agents can call deterministically, and resist all scope creep toward CRM, reporting, or frontend concerns.

The recommended approach is a 4-phase build following strict domain dependency order: Foundation + Identity + Services Catalog → Scheduling Engine → Payment Engine → Conversation Tracking. The stack mirrors the sibling OrchestratorAI project (Node.js 20, Express 4, Prisma 6, PostgreSQL 15) with one critical addition: slots must be calculated at query time from working hours rules — never stored as database rows. This single architectural decision eliminates an entire class of synchronization problems. Conflict detection must live at the PostgreSQL level via a partial unique index, not application-level locking, which fails under concurrent load.

The primary risk is Phase 2 (Scheduling Engine), which concentrates 4 critical pitfalls: race conditions on slot availability, stale pre-reservation TTL handling, duration-overlap detection with interval math, and end-of-day boundary overrun. These are all well-known problems in booking systems with well-known solutions. The risk is not unknowns — it is implementation discipline. The second risk is timezone handling: using `TIMESTAMPTZ` and UTC storage must be decided in Phase 1 and never deviated from. Setting timezone strategy after the fact requires a data migration.

---

## Key Findings

### Recommended Stack

The stack is high-confidence because it is anchored to verified production versions from the sibling OrchestratorAI project. No technology choices require evaluation — they are already in use and proven. The only deferred addition is Redis (ioredis + Bull) for TTL-based pre-reservation expiry. For MVP, PostgreSQL-only TTL via `expiresAt` timestamp and a node-cron sweep every 30 seconds is sufficient. Add Redis when concurrent booking volume demands sub-second precision.

**Core technologies:**
- **Node.js 20 LTS + Express 4.21** — runtime and framework, same as OrchestratorAI, stable and proven
- **Prisma 6 + PostgreSQL 15** — ORM and database; ACID compliance is mandatory for conflict detection; partial unique indexes are the core safety mechanism
- **Zod 3.24** — request/response validation at API boundary; same library already in use
- **date-fns 3.6** — slot calculation and date arithmetic; lightweight alternative to deprecated Moment.js
- **uuid 11 (v7)** — time-ordered UUIDs for booking IDs; sortable by creation time
- **jsonwebtoken + bcryptjs** — AI agent API key auth and admin credential hashing
- **Bull + node-cron** — deferred to post-MVP; needed if Redis is added for TTL precision
- **winston** — structured logging for production observability

**Do not use:** MongoDB (no ACID), Sequelize (inferior to Prisma), TypeORM (no reason to switch), GraphQL (over-engineered for 8 fixed endpoints), Moment.js (deprecated), Express 5 RC (not stable).

### Expected Features

Research identifies a clear 5-step critical path that is the entire purpose of the platform: Client lookup → Slot query → Conflict detection → Booking creation → Confirmation response. Every other feature either enables or enriches this path.

**Must have (table stakes) — 15 features for MVP:**
- Client upsert (register + lookup by phone in single call) — AI does not do a separate registration step
- Service catalog with duration and price — AI must quote and describe services
- Service-to-professional assignment (many-to-many) — not every professional does every service
- Professional weekly availability configuration — the input to slot generation
- Available slot query (by date, service, professional) — core scheduling action, hot path
- Atomic booking creation with DB-level conflict detection — race-condition safe
- Booking confirmation response (structured object) — AI composes confirmation message from this
- Booking lookup by client phone — "your upcoming appointments"
- Booking cancellation — frees slot back to availability
- Payment record with price snapshot at booking time — prices change; historical records must not
- Payment status tracking (pending/paid/cancelled) — receptionist visibility
- Idempotency key on booking creation — AI agent retries must not double-book
- Structured error codes AI can interpret — not just HTTP 4xx status codes
- Session-to-booking linkage (conversationId on booking) — audit trail
- "Next N available slots" query — reduces AI conversation turns significantly

**Should have (MVP differentiators):**
- Conflict explanation in availability response (`NOT_WORKING_DAY` vs `FULLY_BOOKED` vs `NO_SERVICE`) — enables AI to give actionable response
- Client auto-create on first booking (upsert on phone) — eliminates two-step registration
- Idempotent confirm endpoint — returns existing confirmed booking if already confirmed

**Defer to post-MVP:**
- Atomic rebook (cancel + rebook in one call) — two calls works for v1
- Booking intent/hold pattern (slot reserved for 5 min while AI converses) — PostgreSQL TTL approach sufficient for MVP volume
- Waitlist — complex state machine, low immediate need
- Recurring appointments — complex scheduling, not needed for AI conversation flow
- Multi-service single appointment — requires sequential slot math
- Webhook events — useful but not blocking AI consumption
- Google Calendar sync — OAuth complexity, not needed for launch
- Manager reporting/dashboard — booking data supports ad-hoc queries

**Anti-features — explicitly out of scope:**
Full CRM, inventory management, staff payroll, marketing campaigns, public booking widgets, video conferencing, dynamic pricing, loyalty points, multi-tenant billing, real-time WebSocket streaming, and NLU inside the platform (OrchestratorAI handles NLU; this platform receives structured API calls only).

### Architecture Approach

The platform is organized as 5 domain components with a clear dependency hierarchy. Components 1 and 2 are foundational with no upstream dependencies. Component 3 (Scheduling Engine) depends on both. Components 4 and 5 depend on Component 3 and can be built in parallel after it. The project structure follows a Controller → Service → Repository pattern; fat controllers are explicitly an anti-pattern here because the scheduling engine logic (slot generation, conflict detection, TTL management) is non-trivial and must be unit-testable in isolation.

**Major components:**
1. **Identity & Clients** — client records, phone-based lookup, no CRM features; foundational, no upstream deps
2. **Services Catalog** — service definitions, professional profiles, service-to-professional assignment; foundational, no upstream deps
3. **Scheduling Engine (Core)** — slot generation (calculated, not stored), pre-reservation with TTL, atomic booking creation, conflict detection via PostgreSQL partial unique index, booking lifecycle (PRE_RESERVED → CONFIRMED → CANCELLED)
4. **Payment Engine** — PIX simulation for MVP, payment intent creation, status tracking, webhook receiver for real payment gateway (post-MVP)
5. **Conversation Tracking** — links OrchestratorAI conversation sessions to bookings; isolated in its own table to prevent tracking failures from blocking booking creation

**Key architectural rules:**
- Slots are NEVER stored as database rows; they are calculated at query time from working hours minus existing active bookings
- Conflict detection is ALWAYS at PostgreSQL level via partial unique index on `(professional_id, start_time)` where status is active — never application-level
- Conversation tracking failures NEVER block booking creation — decoupled via optional foreign key

### Critical Pitfalls

All 6 critical pitfalls (causes of rewrites or double-bookings) are well-understood problems with known solutions. The risk is forgetting to implement the solution, not discovering a novel problem.

1. **Race conditions / TOCTOU double-booking** — use PostgreSQL partial unique index on `(professional_id, start_time)` for active bookings + `SELECT FOR UPDATE SKIP LOCKED` in booking transaction; never rely on application-level check-then-insert
2. **Stale TTL pre-reservations blocking availability** — availability queries MUST include `WHERE (status != 'PRE_RESERVED' OR expires_at > NOW())`; the cleanup cron is cosmetic, not functional
3. **Duration overlap detection using point equality** — use interval overlap formula: `existing_start < new_end AND existing_end > new_start`; store both `startTime` and `endTime` on every booking
4. **Timezone naivety** — use `TIMESTAMPTZ` everywhere in PostgreSQL schema; store UTC; convert at API boundary only; store salon timezone in config as `America/Sao_Paulo`; set this strategy in Phase 1 schema, never retrofitted
5. **End-of-day slot overrun** — last offered slot must satisfy `slot_start + service_duration + buffer <= work_end`; test explicitly with edge cases
6. **Multi-service schema lock-in** — design `BookingService` as one-to-many from Booking in Phase 1 schema even though MVP restricts to single service; retrofitting this relationship after data exists is painful

---

## Implications for Roadmap

Based on research, the dependency chain is unambiguous and the phase structure follows directly from it. There is no alternative ordering that makes sense.

### Phase 1: Foundation + Identity + Services Catalog

**Rationale:** No dependencies upstream. Everything else depends on clients (who is booking) and services (what is being booked). Timezone strategy and schema design decisions made here cannot be cheaply changed later.
**Delivers:** Running Express server, Prisma schema with all models, client CRUD with phone upsert, service catalog CRUD, professional CRUD, service-to-professional assignments, API key authentication middleware, global error handler with structured error envelope.
**Addresses:** Client registration + lookup, service listing, service-to-professional assignment, service duration as first-class field, authentication, consistent error envelope.
**Avoids:** Pitfall #4 (timezone — set `TIMESTAMPTZ` from first migration), Pitfall #6 (multi-service schema — design `BookingService` one-to-many from day one).
**Research flag:** Standard patterns — no additional research needed for this phase.

### Phase 2: Scheduling Engine

**Rationale:** Depends on Phase 1 (needs service duration for slot calculation, needs client for booking). This is the highest-risk phase with 4 critical pitfalls. It is also the highest-value phase — without it, there is no product. Slot generation algorithm and conflict detection must be implemented with care and tested against edge cases before any dependent phase begins.
**Delivers:** Working hours configuration (weekly recurring rules), slot generation algorithm (calculated, not stored), pre-reservation endpoint with `expiresAt` TTL, booking creation with DB-level conflict detection, booking confirm/cancel, booking lookup by client, idempotency key support, structured availability response with `NOT_WORKING_DAY` / `FULLY_BOOKED` reason codes, composite index on bookings for query performance.
**Uses:** PostgreSQL partial unique index, `SELECT FOR UPDATE SKIP LOCKED`, interval overlap math, `expiresAt` filtering in availability queries, node-cron for cleanup sweep.
**Implements:** Scheduling Engine component (core of architecture).
**Avoids:** Pitfall #1 (race conditions), Pitfall #2 (TTL expiry), Pitfall #3 (duration overlap), Pitfall #5 (end-of-day overrun), Pitfall #7 (idempotency), Pitfall #8 (availability query performance), Pitfall #11 (availability reason codes), Pitfall #12 (slot granularity), Pitfall #14 (buffer time), Pitfall #15 (expired hold on confirm).
**Research flag:** Needs careful review during planning. Consider `/gsd:research-phase` for the slot generation algorithm implementation specifically. The math is known but the Prisma query patterns for `SELECT FOR UPDATE` may need reference.

### Phase 3: Payment Engine

**Rationale:** Depends on Phase 2 (payment is linked to a booking). Isolated enough to be self-contained. For MVP, payment is simulated — no external gateway integration required.
**Delivers:** PIX payment intent creation (simulated), payment status tracking (PENDING/PAID/CANCELLED), `simulate-payment` endpoint for dev/test, price snapshot stored at booking time (never read from live catalog), extended pre-reservation TTL when payment is initiated (avoids Pitfall #9).
**Implements:** Payment Engine component.
**Avoids:** Pitfall #9 (PIX hold window — extend TTL when payment initiated).
**Research flag:** Standard patterns for MVP simulation. If real PIX gateway integration is scoped post-MVP, that phase will need research on the specific payment provider's webhook format.

### Phase 4: Conversation Tracking + Integration Polish

**Rationale:** Depends on Phase 2 (needs booking IDs to link). Can run in parallel with Phase 3 after Phase 2 completes. Final phase closes the loop between OrchestratorAI conversations and booking records, and hardens the API for production agent consumption.
**Delivers:** Separate `ConversationLink` table (decoupled from booking model), `conversationId` optional on booking creation, query bookings by conversation, booking state change audit trail (`BookingEvent` table), Swagger/OpenAPI documentation at `/api-docs`, rate limiting on all endpoints, final error code review.
**Avoids:** Pitfall #10 (conversation tracking separate from booking model), Pitfall #13 (audit trail for booking state changes).
**Research flag:** Standard patterns — no additional research needed.

### Phase Ordering Rationale

- **Phases 1 → 2 is the critical dependency chain.** There is no scheduling without clients and services. Phase 1 must be complete before Phase 2 starts.
- **Phase 3 and Phase 4 can run in parallel** after Phase 2 completes, if multiple developers are available. Each depends on booking records but not on each other.
- **The 4-phase structure mirrors the 5-component architecture** directly, with Phase 1 covering the two foundational components (Identity + Catalog), keeping implementation batches tight and reviewable.
- **Schema decisions in Phase 1 are load-bearing.** Timezone (`TIMESTAMPTZ`), `BookingService` one-to-many shape, and the partial unique index design should all be finalized in Phase 1 schema review before any service layer is written.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2 (Scheduling Engine):** The slot generation algorithm implementation in Prisma/PostgreSQL warrants a dedicated research step. Specifically: how to express `SELECT FOR UPDATE SKIP LOCKED` via Prisma raw query, the exact partial unique index DDL in Prisma schema (`@@index` with a `where` clause via `raw`), and the interval overlap condition in a Prisma `where` clause.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Foundation):** Express + Prisma setup is well-documented. Team already has a working reference in OrchestratorAI.
- **Phase 3 (Payment Engine):** Simulated payment for MVP is trivial. No external API integration required.
- **Phase 4 (Conversation Tracking):** Standard audit table pattern; Swagger setup is well-documented.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Pinned to OrchestratorAI production versions; no speculative choices |
| Features | HIGH | Table stakes are industry-standard; AI ergonomics differentiators are MEDIUM but the must-haves are clear |
| Architecture | HIGH | Slot-calculation-not-stored and DB-level conflict detection are industry best practices with abundant precedent |
| Pitfalls | HIGH | All critical pitfalls are well-documented in booking system literature; no novel risks identified |

**Overall confidence: HIGH**

### Gaps to Address

- **Redis vs PostgreSQL-only TTL at MVP scale:** Research recommends starting with PostgreSQL-only (`expiresAt` + cron) and adding Redis later. The threshold for "when to add Redis" is not defined. During planning, set an explicit criterion (e.g., >50 concurrent booking attempts/minute) that triggers the Redis addition.
- **PIX payment gateway specifics (post-MVP):** The MVP uses simulated payment. If real PIX integration is scoped for a future milestone, the webhook format, payment status codes, and signing requirements for the specific gateway (e.g., Pagar.me, Gerencianet/Efí) will need dedicated research.
- **Multi-tenant expansion:** Research confirms this platform is single-tenant (one salon). If multi-tenant is ever needed, it is a separate milestone and would require schema changes (add `tenantId` to all tables). Flag this during Phase 1 schema review — adding a `salonId` now costs almost nothing.
- **Prisma raw query for partial unique index:** Prisma schema DSL does not natively support `WHERE` clause on indexes. The partial unique index will require a raw SQL migration step. Validate this approach during Phase 2 planning.

---

## Sources

### Primary (HIGH confidence)
- OrchestratorAI production `package.json` — verified stack versions (Node 20, Express 4.21.2, Prisma 6.19.0, Zod 3.24.2, Jest 29.7.0)
- PostgreSQL 15 official documentation — partial unique indexes, `TIMESTAMPTZ`, `SELECT FOR UPDATE SKIP LOCKED`
- Prisma 6 documentation — schema definition, raw queries, migration DDL

### Secondary (MEDIUM confidence)
- Industry scheduling system patterns (Calendly, Acuity, Square Appointments, Fresha) — table stakes feature convergence
- Booking system literature — race condition patterns, TTL expiry strategies, interval overlap math
- OrchestratorAI TRANSFORM capability mock analysis — MVP scoping context for what the AI agent currently fakes

### Tertiary (MEDIUM confidence, domain-specific)
- Brazil PIX payment flow patterns — timing estimates for pre-reservation window (5-10 min); specific gateway requirements need validation when integration is scoped
- Beauty salon operations domain knowledge — buffer time defaults, working hours patterns

---
*Research completed: 2026-03-13*
*Ready for roadmap: yes*
