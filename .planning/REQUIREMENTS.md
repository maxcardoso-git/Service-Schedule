# Requirements: Service-schedule — AI Scheduling Platform

**Defined:** 2026-03-13
**Core Value:** Permitir que agentes de IA realizem todas as operações de agenda de forma autônoma, com rastreabilidade conversacional.

## v1 Requirements

### Identity & Clients

- [ ] **CLNT-01**: User can look up a client by phone number (returns client or 404)
- [ ] **CLNT-02**: User can register a new client (name, phone, email)
- [ ] **CLNT-03**: User can query a client's appointment history

### Services Catalog

- [ ] **SRVC-01**: User can list available services with name, duration, and price
- [ ] **SRVC-02**: Admin can create/edit/deactivate services
- [ ] **SRVC-03**: Admin can assign professionals to services (many-to-many)
- [ ] **SRVC-04**: Admin can manage professional profiles and working hours

### Scheduling Engine

- [ ] **SCHD-01**: User can query available time slots by date, service, and professional
- [ ] **SCHD-02**: User can create a pre-reservation with TTL (5 min hold)
- [ ] **SCHD-03**: User can confirm a booking (moves PRE_RESERVED → CONFIRMED)
- [ ] **SCHD-04**: User can cancel a booking (frees slot)
- [ ] **SCHD-05**: User can look up bookings by client phone
- [ ] **SCHD-06**: Availability response distinguishes "fully booked" vs "not working" with next-available suggestion
- [ ] **SCHD-07**: Conflict detection enforced at database level (partial unique index)
- [ ] **SCHD-08**: Expired pre-reservations filtered at query time (not dependent on cleanup cron)

### Payment Engine

- [ ] **PYMT-01**: User can generate a PIX payment intent for a booking (simulated)
- [ ] **PYMT-02**: User can check payment status (PENDING/PAID/CANCELLED)
- [ ] **PYMT-03**: Simulate payment endpoint marks payment as PAID (dev/test)

### Conversation Tracking

- [ ] **CONV-01**: Booking stores optional conversationId linking to OrchestratorAI session
- [ ] **CONV-02**: User can query bookings by conversationId

### API Infrastructure

- [ ] **INFR-01**: API key authentication middleware
- [ ] **INFR-02**: Structured error responses with codes AI agents can act on
- [ ] **INFR-03**: Idempotency key support on booking creation
- [ ] **INFR-04**: Swagger/OpenAPI documentation at /api-docs
- [ ] **INFR-05**: Request validation with Zod schemas
- [ ] **INFR-06**: Health check endpoint

### Admin & Seed

- [ ] **ADMN-01**: Seed data with sample services, professionals, and working hours for beauty salon
- [ ] **ADMN-02**: Admin user authentication (JWT)

## v2 Requirements

Deferred to next release.

### UX & Frontend
- **FRONT-01**: Frontend admin UI (calendar view, booking management)
- **FRONT-02**: Receptionist simplified interface

### Advanced Scheduling
- **ASCH-01**: Booking rescheduling (atomic cancel + rebook)
- **ASCH-02**: Multi-service booking in single session
- **ASCH-03**: Recurring appointment booking
- **ASCH-04**: Waitlist for fully booked slots
- **ASCH-05**: Buffer time configuration per professional/service

### Integrations
- **INTG-01**: Webhook events on booking state changes
- **INTG-02**: Google Calendar sync
- **INTG-03**: Real PIX payment gateway integration
- **INTG-04**: Redis for TTL-based pre-reservation (performance)

### Observability
- **OBSV-01**: Booking conversion funnel (AI session → booking)
- **OBSV-02**: No-show rate tracking
- **OBSV-03**: Revenue projection dashboard

## Out of Scope

| Feature | Reason |
|---------|--------|
| CRM features (notes, tags, contact timeline) | Not a CRM — booking history IS the relationship |
| Staff payroll / commission | HR domain, not scheduling |
| Marketing campaigns | Separate product |
| Dynamic pricing / surge pricing | Confuses AI conversations |
| Multi-tenant / SaaS billing | Single tenant for OrchestratorAI |
| Mobile app | Web only |
| Real-time WebSocket streaming | REST polling sufficient |
| Built-in NLU | OrchestratorAI handles NLU |
| Public booking widget | AI agent IS the booking channel |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| CLNT-01 | Phase 1 | Pending |
| CLNT-02 | Phase 1 | Pending |
| CLNT-03 | Phase 1 | Pending |
| SRVC-01 | Phase 1 | Pending |
| SRVC-02 | Phase 1 | Pending |
| SRVC-03 | Phase 1 | Pending |
| SRVC-04 | Phase 1 | Pending |
| SCHD-01 | Phase 2 | Pending |
| SCHD-02 | Phase 2 | Pending |
| SCHD-03 | Phase 2 | Pending |
| SCHD-04 | Phase 2 | Pending |
| SCHD-05 | Phase 2 | Pending |
| SCHD-06 | Phase 2 | Pending |
| SCHD-07 | Phase 2 | Pending |
| SCHD-08 | Phase 2 | Pending |
| PYMT-01 | Phase 3 | Pending |
| PYMT-02 | Phase 3 | Pending |
| PYMT-03 | Phase 3 | Pending |
| CONV-01 | Phase 4 | Pending |
| CONV-02 | Phase 4 | Pending |
| INFR-01 | Phase 1 | Pending |
| INFR-02 | Phase 1 | Pending |
| INFR-03 | Phase 2 | Pending |
| INFR-04 | Phase 4 | Pending |
| INFR-05 | Phase 1 | Pending |
| INFR-06 | Phase 1 | Pending |
| ADMN-01 | Phase 1 | Pending |
| ADMN-02 | Phase 1 | Pending |

**Coverage:**
- v1 requirements: 28 total
- Mapped to phases: 28/28
- Unmapped: 0

---
*Requirements defined: 2026-03-13*
*Traceability updated: 2026-03-13*
