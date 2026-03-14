# Requirements: Service-schedule — AI Scheduling Platform

**Defined:** 2026-03-13
**Core Value:** Permitir que agentes de IA realizem todas as operações de agenda de forma autônoma, com rastreabilidade conversacional e interface administrativa para operação humana.

## v1.0 Requirements

### Identity & Clients

- [x] **CLNT-01**: User can look up a client by phone number (returns client or 404)
- [x] **CLNT-02**: User can register a new client (name, phone, email)
- [x] **CLNT-03**: User can query a client's appointment history

### Services Catalog

- [x] **SRVC-01**: User can list available services with name, duration, and price
- [x] **SRVC-02**: Admin can create/edit/deactivate services
- [x] **SRVC-03**: Admin can assign professionals to services (many-to-many)
- [x] **SRVC-04**: Admin can manage professional profiles and working hours

### Scheduling Engine

- [x] **SCHD-01**: User can query available time slots by date, service, and professional
- [x] **SCHD-02**: User can create a pre-reservation with TTL (5 min hold)
- [x] **SCHD-03**: User can confirm a booking (moves PRE_RESERVED → CONFIRMED)
- [x] **SCHD-04**: User can cancel a booking (frees slot)
- [x] **SCHD-05**: User can look up bookings by client phone
- [x] **SCHD-06**: Availability response distinguishes "fully booked" vs "not working" with next-available suggestion
- [x] **SCHD-07**: Conflict detection enforced at database level (partial unique index)
- [x] **SCHD-08**: Expired pre-reservations filtered at query time (not dependent on cleanup cron)

### Payment Engine

- [x] **PYMT-01**: User can generate a PIX payment intent for a booking (simulated)
- [x] **PYMT-02**: User can check payment status (PENDING/PAID/CANCELLED)
- [x] **PYMT-03**: Simulate payment endpoint marks payment as PAID (dev/test)

### Conversation Tracking

- [x] **CONV-01**: Booking stores optional conversationId linking to OrchestratorAI session
- [x] **CONV-02**: User can query bookings by conversationId

### API Infrastructure

- [x] **INFR-01**: API key authentication middleware
- [x] **INFR-02**: Structured error responses with codes AI agents can act on
- [x] **INFR-03**: Idempotency key support on booking creation
- [x] **INFR-04**: Swagger/OpenAPI documentation at /api-docs
- [x] **INFR-05**: Request validation with Zod schemas
- [x] **INFR-06**: Health check endpoint

### Admin & Seed

- [x] **ADMN-01**: Seed data with sample services, professionals, and working hours for beauty salon
- [x] **ADMN-02**: Admin user authentication (JWT)

## v2.0 Requirements

Requirements for v2.0 Frontend release. Each maps to roadmap phases (continuing from phase 5+).

### Foundation & Auth

- [x] **FAUTH-01**: Login page with email/password form, JWT token storage, and auto-redirect on session expiry
- [x] **FAUTH-02**: AdminUser model gains `role` field (ADMIN, RECEPTIONIST) via Prisma migration; JWT payload includes role
- [x] **FAUTH-03**: Role-based frontend routing — admin sees full dashboard, receptionist sees simplified interface
- [x] **FAUTH-04**: Admin can create, edit, and deactivate admin/receptionist user accounts
- [x] **FAUTH-05**: CORS middleware configured on backend for frontend origin

### Services & Professionals Management

- [x] **FMGMT-01**: Admin can view services in a table with name, duration, price, and active status
- [x] **FMGMT-02**: Admin can create, edit, and deactivate services via modal/form
- [x] **FMGMT-03**: Admin can view professionals in a table with name, contact info, active status, and assigned services
- [x] **FMGMT-04**: Admin can create, edit, and deactivate professionals via modal/form
- [x] **FMGMT-05**: Admin can assign/remove services to/from a professional using multi-select
- [x] **FMGMT-06**: Admin can configure working hours per professional via visual weekly grid (Mon-Sun with start/end times)

### Calendar & Booking (Admin)

- [x] **FCAL-01**: Admin sees a calendar view (day and week modes) with bookings rendered as time blocks in per-professional columns
- [x] **FCAL-02**: Booking blocks are color-coded by status (PRE_RESERVED=yellow, CONFIRMED=blue, COMPLETED=green, CANCELLED=gray, NO_SHOW=red)
- [x] **FCAL-03**: Admin can create a booking via multi-step flow: search/create client → pick service → pick professional → pick available slot → confirm
- [x] **FCAL-04**: Admin can transition booking status: confirm, cancel, mark as completed, mark as no-show
- [x] **FCAL-05**: Dashboard shows KPI cards: bookings today, revenue today, no-show count, occupancy percentage

### Client Management

- [x] **FCLNT-01**: Admin can search clients by phone and view results
- [x] **FCLNT-02**: Admin can register new clients (name, phone, email)
- [x] **FCLNT-03**: Admin can view a client's appointment history

### Receptionist Interface

- [x] **FRCPT-01**: Receptionist sees today's agenda as a timeline grouped by professional
- [x] **FRCPT-02**: Receptionist can create bookings via quick 3-step flow: phone lookup → service + slot → confirm
- [x] **FRCPT-03**: Receptionist can search clients by phone and see name + last visit
- [x] **FRCPT-04**: Receptionist can check slot availability for a service/date

### Frontend Infrastructure

- [x] **FINF-01**: React 19 + Vite frontend project scaffolded with router, API client, and auth context
- [x] **FINF-02**: Express backend serves Vite production build as static files (single PM2 process)
- [x] **FINF-03**: Backend gains necessary new endpoints: GET /api/clients (list), PATCH /api/bookings/:id/status, GET /api/admin/dashboard/stats

## v2.1 Requirements

Deferred to next release. Tracked but not in current roadmap.

### UX Enhancements

- **UXE-01**: Drag-and-drop booking reschedule on calendar
- **UXE-02**: Professional utilization analytics view
- **UXE-03**: Responsive tablet layout for receptionist interface
- **UXE-04**: Print daily agenda (CSS print stylesheet)
- **UXE-05**: Bulk working hours template
- **UXE-06**: Booking notes field
- **UXE-07**: Payment status badge on booking cards
- **UXE-08**: Quick client history popup

### Advanced Scheduling

- **ASCH-01**: Booking rescheduling (atomic cancel + rebook)
- **ASCH-02**: Multi-service booking in single session
- **ASCH-03**: Recurring appointment booking
- **ASCH-04**: Waitlist for fully booked slots

### Integrations

- **INTG-01**: Webhook events on booking state changes
- **INTG-02**: Google Calendar sync
- **INTG-03**: Real PIX payment gateway integration

## Out of Scope

| Feature | Reason |
|---------|--------|
| Online client self-booking portal | AI agent (OrchestratorAI) IS the self-booking interface |
| SMS/WhatsApp notifications | OrchestratorAI handles client communication |
| Loyalty/rewards program | Scope creep — visit count derivable from history |
| Inventory/product management | Different product domain |
| Financial reports/accounting | Payment is simulated PIX only |
| Multi-location support | Single-tenant deployment |
| Staff payroll/commission | HR/payroll is separate domain |
| Recurring appointments | Complex state machine — book manually each visit |
| Real-time WebSocket updates | 2 concurrent users don't justify complexity — use polling |
| Mobile app | Web only |
| Dynamic/surge pricing | Confuses AI conversations |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| CLNT-01 | Phase 1 | Complete |
| CLNT-02 | Phase 1 | Complete |
| CLNT-03 | Phase 1 | Complete |
| SRVC-01 | Phase 1 | Complete |
| SRVC-02 | Phase 1 | Complete |
| SRVC-03 | Phase 1 | Complete |
| SRVC-04 | Phase 1 | Complete |
| SCHD-01 | Phase 2 | Complete |
| SCHD-02 | Phase 2 | Complete |
| SCHD-03 | Phase 2 | Complete |
| SCHD-04 | Phase 2 | Complete |
| SCHD-05 | Phase 2 | Complete |
| SCHD-06 | Phase 2 | Complete |
| SCHD-07 | Phase 2 | Complete |
| SCHD-08 | Phase 2 | Complete |
| PYMT-01 | Phase 3 | Complete |
| PYMT-02 | Phase 3 | Complete |
| PYMT-03 | Phase 3 | Complete |
| CONV-01 | Phase 4 | Complete |
| CONV-02 | Phase 4 | Complete |
| INFR-01 | Phase 1 | Complete |
| INFR-02 | Phase 1 | Complete |
| INFR-03 | Phase 2 | Complete |
| INFR-04 | Phase 4 | Complete |
| INFR-05 | Phase 1 | Complete |
| INFR-06 | Phase 1 | Complete |
| ADMN-01 | Phase 1 | Complete |
| ADMN-02 | Phase 1 | Complete |
| FAUTH-01 | Phase 5 | Complete |
| FAUTH-02 | Phase 5 | Complete |
| FAUTH-03 | Phase 5 | Complete |
| FAUTH-04 | Phase 5 | Complete |
| FAUTH-05 | Phase 5 | Complete |
| FINF-01 | Phase 5 | Complete |
| FINF-02 | Phase 5 | Complete |
| FINF-03 | Phase 5 | Complete |
| FMGMT-01 | Phase 6 | Complete |
| FMGMT-02 | Phase 6 | Complete |
| FMGMT-03 | Phase 6 | Complete |
| FMGMT-04 | Phase 6 | Complete |
| FMGMT-05 | Phase 6 | Complete |
| FMGMT-06 | Phase 6 | Complete |
| FCAL-01 | Phase 7 | Complete |
| FCAL-02 | Phase 7 | Complete |
| FCAL-03 | Phase 7 | Complete |
| FCAL-04 | Phase 7 | Complete |
| FCAL-05 | Phase 7 | Complete |
| FCLNT-01 | Phase 7 | Complete |
| FCLNT-02 | Phase 7 | Complete |
| FCLNT-03 | Phase 7 | Complete |
| FRCPT-01 | Phase 8 | Complete |
| FRCPT-02 | Phase 8 | Complete |
| FRCPT-03 | Phase 8 | Complete |
| FRCPT-04 | Phase 8 | Complete |

**Coverage:**
- v1.0 requirements: 28 total (all Complete)
- v2.0 requirements: 26 total
- Mapped to phases: 26/26
- Unmapped: 0

---
*Requirements defined: 2026-03-13*
*v2.0 requirements added: 2026-03-14*
*v2.0 traceability updated: 2026-03-14*
