# Roadmap: Service-schedule — AI Scheduling Platform

## Overview

This platform exposes a REST API backend enabling OrchestratorAI agents to autonomously perform all scheduling operations at a beauty salon — from client lookup through slot discovery, pre-reservation, payment generation, and booking confirmation. The build follows a strict dependency chain: foundation and data catalogs first, then the scheduling engine (the highest-risk and highest-value component), then the payment layer, and finally conversation traceability. All 8 capability-mapped endpoints become operational by end of Phase 2, with the full v1 surface complete by Phase 4.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation + Identity + Catalog** - Running Express server with API key auth, client CRUD, and services/professionals catalog
- [x] **Phase 2: Scheduling Engine** - Slot generation, pre-reservation with TTL, atomic booking with DB-level conflict detection, confirm/cancel lifecycle
- [ ] **Phase 3: Payment Engine** - Simulated PIX payment intent creation, status tracking, and dev simulation endpoint
- [ ] **Phase 4: Conversation Tracking + Integration Polish** - ConversationId linkage, booking query by conversation, Swagger docs, final API hardening

## Phase Details

### Phase 1: Foundation + Identity + Catalog

**Goal**: AI agents and admins can authenticate, look up or register clients by phone, and query the services/professionals catalog — the foundational data layer all scheduling depends on.

**Depends on**: Nothing (first phase)

**Requirements**: INFR-01, INFR-02, INFR-05, INFR-06, ADMN-01, ADMN-02, CLNT-01, CLNT-02, CLNT-03, SRVC-01, SRVC-02, SRVC-03, SRVC-04

**Success Criteria** (what must be TRUE):
  1. An AI agent calling `GET /api/clients/by-phone/:phone` receives a client object or a structured 404 with an actionable error code
  2. An AI agent calling `POST /api/clients` successfully registers a new client and returns the created record
  3. An AI agent calling `GET /api/clients/:id/appointments` receives the client's booking history (empty array when none exist)
  4. An AI agent calling `GET /api/services` receives a list of active services with name, duration, and price
  5. An admin can create/edit/deactivate services and assign or remove professionals via admin endpoints authenticated with JWT

**Plans:** 4 plans

Plans:
- [x] 01-01-PLAN.md — Project scaffold (Express app, Prisma + PostgreSQL, environment config, TIMESTAMPTZ strategy, shared utilities)
- [x] 01-02-PLAN.md — API infrastructure (API key middleware, JWT admin auth, Zod validation, structured error envelope, health check, seed data)
- [x] 01-03-PLAN.md — Identity & Clients domain (phone lookup, registration, appointment history endpoint)
- [x] 01-04-PLAN.md — Services Catalog domain (service listing, admin CRUD, professional management, working hours)

---

### Phase 2: Scheduling Engine

**Goal**: AI agents can query available time slots, hold a slot with a pre-reservation, and confirm or cancel a booking — with race-condition-safe conflict detection enforced at the database level.

**Depends on**: Phase 1

**Requirements**: SCHD-01, SCHD-02, SCHD-03, SCHD-04, SCHD-05, SCHD-06, SCHD-07, SCHD-08, INFR-03

**Success Criteria** (what must be TRUE):
  1. An AI agent calling `POST /api/bookings/availability` receives calculated (not stored) available slots for a given date, service, and professional, with `NOT_WORKING` or `FULLY_BOOKED` reason codes when no slots exist and a next-available suggestion
  2. An AI agent calling `POST /api/bookings` with an idempotency key creates a 5-minute hold; a second call with the same key returns the existing hold without creating a duplicate
  3. An AI agent calling `PATCH /api/bookings/:id/confirm` transitions the booking from PRE_RESERVED to CONFIRMED; the slot no longer appears in availability queries
  4. Two simultaneous booking attempts for the same slot result in exactly one success and one conflict error — enforced by the PostgreSQL partial unique index
  5. Expired pre-reservations (past their `expiresAt`) are excluded from availability queries without waiting for a cleanup job

**Plans:** 3 plans

Plans:
- [x] 02-01-PLAN.md — Partial unique index migration, dependency install (date-fns-tz, node-cron), pure slot generation helper
- [x] 02-02-PLAN.md — Booking service layer (availability query, pre-reservation with idempotency, confirm/cancel with row locking, phone lookup)
- [x] 02-03-PLAN.md — Booking routes, Zod validation, cron cleanup job, Express wiring

---

### Phase 3: Payment Engine

**Goal**: AI agents can generate a PIX payment intent linked to a booking, check payment status, and developers can simulate payment confirmation for testing — with price snapshotted at booking time.

**Depends on**: Phase 2

**Requirements**: PYMT-01, PYMT-02, PYMT-03

**Success Criteria** (what must be TRUE):
  1. An AI agent calling `POST /api/payments/pix` for a confirmed booking receives a simulated PIX QR code payload and a payment record with status PENDING
  2. An AI agent calling `GET /api/payments/:id/status` receives the current status (PENDING / PAID / CANCELLED) of the payment
  3. A developer calling `POST /api/payments/:id/simulate-paid` transitions the payment to PAID status, verifiable via the status endpoint

**Plans:** 2 plans

Plans:
- [ ] 03-01-PLAN.md — Payment model (PaymentStatus enum, Payment schema with bookingId @unique), service layer (createPixIntent, getPaymentStatus, simulatePaid)
- [ ] 03-02-PLAN.md — Payment routes (POST /pix, GET /:id/status, POST /:id/simulate-paid), Express app wiring

---

### Phase 4: Conversation Tracking + Integration Polish

**Goal**: Each booking optionally carries a conversationId linking it to an OrchestratorAI session, those sessions are queryable, and the full API surface is documented and hardened for production agent consumption.

**Depends on**: Phase 2 (needs booking records to link; can overlap with Phase 3)

**Requirements**: CONV-01, CONV-02

**Success Criteria** (what must be TRUE):
  1. A booking created with an optional `conversationId` stores it; the field does not block booking creation if absent or if conversation tracking fails
  2. An AI agent calling `GET /api/bookings?conversationId=:id` receives all bookings linked to that OrchestratorAI session
  3. The Swagger/OpenAPI documentation at `/api-docs` accurately describes all endpoints, request schemas, and response shapes, enabling a developer to understand the full API surface without reading source code

**Plans**: TBD

Plans:
- [ ] 04-01: Conversation tracking (optional `conversationId` on Booking, `ConversationLink` table decoupled from booking model, query endpoint)
- [ ] 04-02: API documentation (Swagger/OpenAPI at `/api-docs`, final error code review, integration smoke test against OrchestratorAI capability mock list)

---

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation + Identity + Catalog | 4/4 | Complete | 2026-03-13 |
| 2. Scheduling Engine | 3/3 | Complete | 2026-03-13 |
| 3. Payment Engine | 0/2 | Not started | - |
| 4. Conversation Tracking + Integration Polish | 0/2 | Not started | - |
