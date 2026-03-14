# Roadmap: Service-schedule — AI Scheduling Platform

## Overview

This platform exposes a REST API backend enabling OrchestratorAI agents to autonomously perform all scheduling operations at a beauty salon — from client lookup through slot discovery, pre-reservation, payment generation, and booking confirmation. The build follows a strict dependency chain: foundation and data catalogs first, then the scheduling engine (the highest-risk and highest-value component), then the payment layer, and finally conversation traceability. All 8 capability-mapped endpoints become operational by end of Phase 2, with the full v1 surface complete by Phase 4.

## Milestones

- v1.0 AI Scheduling API — Phases 1-4 (shipped 2026-03-13)
- v2.0 Frontend — Phases 5-8 (in progress)

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

<details>
<summary>v1.0 AI Scheduling API (Phases 1-4) - SHIPPED 2026-03-13</summary>

- [x] **Phase 1: Foundation + Identity + Catalog** - Running Express server with API key auth, client CRUD, and services/professionals catalog
- [x] **Phase 2: Scheduling Engine** - Slot generation, pre-reservation with TTL, atomic booking with DB-level conflict detection, confirm/cancel lifecycle
- [x] **Phase 3: Payment Engine** - Simulated PIX payment intent creation, status tracking, and dev simulation endpoint
- [x] **Phase 4: Conversation Tracking + Integration Polish** - ConversationId linkage, booking query by conversation, Swagger docs, final API hardening

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
- [x] 03-01-PLAN.md — Payment model (PaymentStatus enum, Payment schema with bookingId @unique), service layer (createPixIntent, getPaymentStatus, simulatePaid)
- [x] 03-02-PLAN.md — Payment routes (POST /pix, GET /:id/status, POST /:id/simulate-paid), Express app wiring

---

### Phase 4: Conversation Tracking + Integration Polish

**Goal**: Each booking optionally carries a conversationId linking it to an OrchestratorAI session, those sessions are queryable, and the full API surface is documented and hardened for production agent consumption.

**Depends on**: Phase 2 (needs booking records to link; can overlap with Phase 3)

**Requirements**: CONV-01, CONV-02, INFR-04

**Success Criteria** (what must be TRUE):
  1. A booking created with an optional `conversationId` stores it; the field does not block booking creation if absent or if conversation tracking fails
  2. An AI agent calling `GET /api/bookings?conversationId=:id` receives all bookings linked to that OrchestratorAI session
  3. The Swagger/OpenAPI documentation at `/api-docs` accurately describes all endpoints, request schemas, and response shapes, enabling a developer to understand the full API surface without reading source code

**Plans:** 2 plans

Plans:
- [x] 04-01-PLAN.md — ConversationLink model, migration, fire-and-forget link creation in bookingService, GET /api/bookings?conversationId query endpoint
- [x] 04-02-PLAN.md — Swagger/OpenAPI setup (swagger-jsdoc + swagger-ui-express), @openapi annotations on all route files, /api-docs endpoint

</details>

---

## v2.0 Frontend (Phases 5-8)

**Milestone Goal:** Admin dashboard and receptionist interface with calendar view, booking management, visual CRUD for services/professionals, and simplified receptionist experience -- all served as a single PM2 process from the existing Express backend.

- [x] **Phase 5: Frontend Foundation + Auth** - React scaffold, backend prep (role migration, CORS, new endpoints), login, role-based routing, user management
- [x] **Phase 6: Services & Professionals Management** - Admin CRUD tables and forms for services, professionals, service assignments, and working hours
- [x] **Phase 7: Calendar, Bookings & Client Management** - FullCalendar integration, booking creation/status management, KPI dashboard, client search and history
- [x] **Phase 8: Receptionist Interface** - Simplified today-only agenda, quick booking flow, phone lookup, and availability check

## Phase Details

### Phase 5: Frontend Foundation + Auth

**Goal**: An admin can log in to the web interface, see role-appropriate navigation, and manage user accounts -- with the React app scaffolded, backend role infrastructure in place, and Express serving the frontend build.

**Depends on**: Phase 4 (v1.0 backend complete)

**Requirements**: FINF-01, FINF-02, FINF-03, FAUTH-01, FAUTH-02, FAUTH-03, FAUTH-04, FAUTH-05

**Success Criteria** (what must be TRUE):
  1. A user navigating to the app URL sees a login page, can enter email/password, and upon success is redirected to their role-appropriate dashboard (admin or receptionist)
  2. An admin user sees full navigation (dashboard, services, professionals, calendar, clients, users); a receptionist user sees only the receptionist interface
  3. An admin can create a new user account with ADMIN or RECEPTIONIST role, edit their details, and deactivate them -- changes take effect on the user's next login
  4. A session that expires automatically redirects the user to the login page without a white screen or JS error
  5. The React frontend is served by Express as static files from a single PM2 process (no separate frontend server in production)

**Plans:** 7 plans

Plans:
- [x] 05-01-PLAN.md — Backend auth infrastructure (AdminRole migration, requireRole middleware, login JWT fix, CORS config)
- [x] 05-02-PLAN.md — Backend new endpoints (user CRUD, client list, booking status, dashboard stats)
- [x] 05-03-PLAN.md — Frontend scaffold (Vite 8, React 19, Tailwind v4, shadcn/ui, path aliases, API proxy)
- [x] 05-04-PLAN.md — Auth flow (Zustand auth store, API client, login page, ProtectedRoute)
- [x] 05-05-PLAN.md — Layout + role routing (AppLayout, Sidebar, Header, Dashboard page)
- [x] 05-06-PLAN.md — User management (CRUD table with create/edit dialogs)
- [x] 05-07-PLAN.md — Production serving + end-to-end verification

---

### Phase 6: Services & Professionals Management

**Goal**: An admin can visually manage the full services and professionals catalog -- creating, editing, deactivating records, assigning services to professionals, and configuring weekly working hours -- replacing direct API/database manipulation.

**Depends on**: Phase 5

**Requirements**: FMGMT-01, FMGMT-02, FMGMT-03, FMGMT-04, FMGMT-05, FMGMT-06

**Success Criteria** (what must be TRUE):
  1. An admin can view all services in a searchable table, click to edit any service's name/duration/price, and toggle its active status -- changes are immediately reflected in the table without page reload
  2. An admin can view all professionals in a table showing their assigned services, click to edit profile details, and toggle active status
  3. An admin can open a professional's detail view and assign or remove services using a multi-select control -- the professional's availability query reflects only assigned services
  4. An admin can configure a professional's working hours via a visual weekly grid (Mon-Sun), setting start/end times per day -- the availability engine respects these hours for slot generation

**Plans:** 3 plans

Plans:
- [x] 06-01-PLAN.md — Backend list endpoint + Services CRUD page (table, create/edit dialogs, active toggle)
- [x] 06-02-PLAN.md — Backend list endpoint + Professionals CRUD page with service assignment dialog
- [x] 06-03-PLAN.md — Working hours visual weekly grid dialog on Professionals page

---

### Phase 7: Calendar, Bookings & Client Management

**Goal**: An admin can see all bookings on a calendar, create new bookings through a guided flow, manage booking statuses, look up clients, and view dashboard KPIs -- the core operational interface for running the salon day-to-day.

**Depends on**: Phase 6 (needs services/professionals data and established component patterns)

**Requirements**: FCAL-01, FCAL-02, FCAL-03, FCAL-04, FCAL-05, FCLNT-01, FCLNT-02, FCLNT-03

**Success Criteria** (what must be TRUE):
  1. An admin viewing the calendar sees bookings as time blocks in per-professional columns, can switch between day and week views, and booking blocks are color-coded by status (yellow=pre-reserved, blue=confirmed, green=completed, gray=cancelled, red=no-show)
  2. An admin can create a booking by searching/registering a client, selecting a service and professional, picking an available slot, and confirming -- the new booking appears on the calendar immediately
  3. An admin can click a booking and transition its status (confirm, cancel, complete, no-show) -- the color updates and the action is persisted
  4. An admin can search clients by phone, register new clients, and view any client's appointment history in a detail view
  5. The dashboard displays KPI cards showing bookings today, revenue today, no-show count, and occupancy percentage -- values update when the page loads

**Plans:** 3 plans

Plans:
- [x] 07-01-PLAN.md — Backend admin endpoints (booking list with filters, client CRUD under JWT, enhanced dashboard KPIs) + FullCalendar install
- [x] 07-02-PLAN.md — Calendar page (FullCalendar day/week views, color-coded bookings, status transitions) + Dashboard KPI update + route wiring
- [x] 07-03-PLAN.md — Clients page (search, register, history) + multi-step booking creation dialog + Calendar integration

---

### Phase 8: Receptionist Interface

**Goal**: A receptionist can handle walk-ins and phone calls efficiently with a focused, today-only interface -- seeing the day's agenda, quickly creating bookings, looking up clients, and checking slot availability without navigating the full admin dashboard.

**Depends on**: Phase 7 (reuses calendar components, booking flow, and client search)

**Requirements**: FRCPT-01, FRCPT-02, FRCPT-03, FRCPT-04

**Success Criteria** (what must be TRUE):
  1. A receptionist logging in sees today's agenda as a timeline grouped by professional, showing all bookings for the current day with status indicators
  2. A receptionist can create a booking in 3 steps (phone lookup, service + slot selection, confirm) without navigating away from the receptionist view
  3. A receptionist can search a client by phone and immediately see the client's name and date of last visit
  4. A receptionist can check available slots for a given service and date, seeing which professionals have openings

**Plans:** 1 plan

Plans:
- [x] 08-01-PLAN.md — Receptionist page (today's agenda by professional, client search, availability check) + 3-step booking dialog + route wiring

---

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation + Identity + Catalog | v1.0 | 4/4 | Complete | 2026-03-13 |
| 2. Scheduling Engine | v1.0 | 3/3 | Complete | 2026-03-13 |
| 3. Payment Engine | v1.0 | 2/2 | Complete | 2026-03-13 |
| 4. Conversation Tracking + Integration Polish | v1.0 | 2/2 | Complete | 2026-03-13 |
| 5. Frontend Foundation + Auth | v2.0 | 7/7 | Complete | 2026-03-14 |
| 6. Services & Professionals Management | v2.0 | 3/3 | Complete | 2026-03-14 |
| 7. Calendar, Bookings & Client Management | v2.0 | 3/3 | Complete | 2026-03-14 |
| 8. Receptionist Interface | v2.0 | 1/1 | Complete | 2026-03-14 |
