# Features Research — AI Scheduling Platform

## Table Stakes

Features users expect. Missing = product feels incomplete or unusable.

### Identity & Clients Domain

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Client registration (name, phone, email) | Every booking system tracks who made the booking | Low | Phone is primary key for WhatsApp-based AI flows |
| Client lookup by phone or email | AI agent needs to identify returning clients | Low | Must be fast; called on every conversation start |
| Client profile (basic contact info) | Receptionists expect this; AI needs it to personalize | Low | Keep minimal — this is not a CRM |
| Duplicate client detection | Phone-based lookup must handle duplicates | Medium | Fuzzy match on phone number variations |
| Preference / history access | "Last service" shown in AI greeting | Medium | Derived from booking history, not a separate field |

### Services Catalog Domain

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Service listing (name, description, duration, price) | AI agent must be able to describe and quote services | Low | Core catalog; no catalog = no booking |
| Service-to-professional assignment | Not every professional does every service | Low | Many-to-many join table |
| Service duration as first-class field | Slot availability depends on it | Low | Must support variable durations (30, 60, 90 min) |
| Service active/inactive toggle | Catalog changes without deleting history | Low | Soft-delete pattern |
| Price display | AI must quote price during conversation | Low | Single price per service is acceptable for MVP |

### Scheduling Engine Domain

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Available slot query (by date, service, professional) | Core scheduling action; everything depends on this | High | Must return slots fast; AI blocks conversation waiting |
| Booking creation | The actual appointment | Low | Creates a record linking client + service + professional + slot |
| Booking confirmation (immediate) | AI must tell client "you're booked" | Low | Synchronous response required |
| Booking lookup by client | AI needs to show "your upcoming appointment" | Low | Query by client ID or phone |
| Booking cancellation | Clients cancel; AI must support this | Medium | Frees the slot back to availability |
| Booking rescheduling | Common client need; AI must handle gracefully | Medium | Cancel + rebook in one transaction |
| Professional availability configuration | Who works on which days/hours | Medium | Weekly recurring schedule is standard |
| Conflict detection | Cannot double-book a professional's slot | Medium | Must be atomic (race condition safe) |
| Buffer time between appointments | Cleanup time after service; affects slot calculation | Medium | Per-service or per-professional setting |

### Payment Engine Domain

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Payment record creation at booking | Track what's owed | Low | Even without charging upfront, record exists |
| Payment status tracking (pending, paid, cancelled) | Receptionists need to know who paid | Low | Simple enum field |
| Price at booking time (snapshot) | Prices change; historical bookings must retain original price | Low | Do NOT read live price from catalog at payment time |
| Payment method recording | Cash, card, PIX — salon owner needs this | Low | Free text or enum |

### Conversation Tracking Domain

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Session-to-booking linkage | Know which AI conversation produced which booking | Low | Foreign key: booking_id on conversation session |
| Booking confirmation data for AI | AI needs structured data to compose confirmation message | Low | Return booking object with all relevant fields |
| Error responses AI can act on | If slot unavailable, AI must understand why | Medium | Structured error codes, not just HTTP 4xx |

### Cross-cutting / API Design

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| RESTful JSON API | AI agents call HTTP endpoints | Low | Standard expectation for any API |
| Authentication (API key or JWT) | Secure access to booking data | Low | Per-agent or per-salon credential |
| Consistent error envelope | AI must parse failures to give user feedback | Low | `{error: {code, message}}` pattern |
| Idempotent booking creation | AI may retry on timeout; must not double-book | Medium | Idempotency key on POST /bookings |
| Fast response times (<500ms for availability) | AI conversation stalls while waiting | Medium | Availability is on the hot path |
| Pagination for list endpoints | Service lists, booking history | Low | Standard cursor or offset |

---

## Differentiators

Features that set this platform apart for AI agent consumption. Not expected by default, but high value when present.

### AI Agent Ergonomics

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Availability as "next N slots" query | AI can offer "tomorrow at 2pm or 4pm" without iterating dates | Medium | `GET /availability?service=X&limit=5` returning next available windows |
| Natural-language-friendly slot formats | Return slots with display labels ("Tomorrow at 2pm") not just ISO timestamps | Low | AI can pass through without date formatting logic |
| Atomic rebook (cancel + create in one call) | Reduces AI conversation turns; prevents partial failures | Medium | Transactional: if new slot unavailable, old slot preserved |
| Conflict explanation in availability response | "Professional unavailable" vs "Slot taken" helps AI phrase response | Low | Add `reason` field to unavailable slots |
| Booking intent / hold pattern | Reserve slot for 5 minutes while AI completes conversation, then confirm | High | Reduces "slot stolen between check and confirm" race |
| Bulk availability (multiple professionals) | "Any professional available at 3pm?" one-call answer | Medium | `GET /availability?service=X&any_professional=true` |
| Client auto-create on first booking | AI does not need separate client-creation step | Low | Upsert on phone number during booking creation |

### Salon Operations

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Professional-specific booking URL | Receptionists can share direct links | Low | Nice-to-have, not core for AI consumption |
| Waitlist for fully booked slots | Capture demand when salon is full | High | Complex state machine; defer post-MVP |
| Recurring appointment booking | Loyal clients book monthly slot series | High | Complex scheduling; defer post-MVP |
| Multi-service booking in one session | Hair + nails in one appointment | High | Requires sequential slot calculation; defer post-MVP |
| Service package / bundle | "Buy 5 sessions, get 1 free" | Very High | Pricing complexity; out of scope |

### Reporting & Observability

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Booking conversion funnel (AI session → booking) | Shows AI effectiveness | Medium | Requires conversation_tracking linkage |
| No-show rate tracking | Operational insight | Low | Add no_show boolean to booking |
| Revenue projection (upcoming bookings × price) | Manager dashboard value | Low | Simple aggregation query |
| AI agent activity log | Debug why AI made certain booking decisions | Medium | Structured log per conversation turn |

### Integrations

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Webhook on booking events | Push notification to external systems | Medium | Standard for modern APIs; enables OrchestratorAI callbacks |
| WhatsApp message with confirmation details | Deliver confirmation through conversation channel | High | Requires WhatsApp Business API; out of scope for this platform |
| Google Calendar sync | Professional sees appointments in personal calendar | High | OAuth complexity; defer post-MVP |
| PIX payment generation (Brazil context) | Generate QR code / copy-paste PIX at booking | High | Payment gateway integration; separate concern |

---

## Anti-Features

Features to explicitly NOT build. Common mistakes in this domain.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Full CRM (notes, tags, full contact timeline) | Scope creep; you are not a CRM | Store minimal client data; booking history IS the relationship |
| Inventory management (products, retail) | Not a scheduling concern | Separate service if ever needed |
| Staff payroll / commission calculation | HR domain, not scheduling | Use booking data as input to external payroll tool |
| Marketing email / SMS campaigns | Different product entirely | Webhook events let external tools trigger campaigns |
| Public booking widget (embeddable) | Complex frontend; not the primary channel | AI agent IS the booking channel; receptionist UI is secondary |
| Built-in video conferencing | Beauty salons are in-person | Do not add virtual appointment types |
| Dynamic pricing / surge pricing | Adds UX complexity; confuses AI conversations | Keep single price per service |
| Loyalty points / rewards engine | Complex; distracts from scheduling core | Use booking count as input; points are a separate system |
| Multi-tenant SaaS platform billing | Not in scope (single-tenant for OrchestratorAI) | If multi-tenant ever needed, treat as separate milestone |
| Real-time availability streaming (WebSocket) | AI polling model works fine; adds infrastructure complexity | Polling availability endpoint on each conversation turn is acceptable |
| AI natural language understanding inside the platform | OrchestratorAI already handles NLU | Platform receives structured API calls, not freeform text |

---

## Feature Dependencies

```
Identity & Clients
  └── Client lookup (phone) ─────────────────────────────────────────────┐
  └── Client auto-create                                                  │
                                                                          │
Services Catalog                                                          │
  └── Service listing                                                     │
  └── Service-to-professional assignment ──────────────────────────────┐  │
  └── Service duration                                                  │  │
                                                                        │  │
Scheduling Engine                                                        │  │
  └── Professional availability config ←──────────────────────────────┘  │
  └── Available slot query ←── (service duration + professional avail)    │
  └── Conflict detection (atomic) ←── (slot query)                       │
  └── Booking creation ←── (slot + service + professional + client) ←──┘
  └── Booking confirmation response                                       │
  └── Booking lookup by client                                            │
  └── Booking cancellation ←── (booking creation)                        │
  └── Booking rescheduling ←── (cancellation + creation)                 │
                                                                          │
Payment Engine                                                            │
  └── Payment record ←── (booking creation, price snapshot)              │
  └── Payment status update ←── (payment record)                         │
                                                                          │
Conversation Tracking                                                     │
  └── Session-to-booking linkage ←── (booking creation)                  │
  └── Confirmation data for AI ←── (booking creation response)
```

**Critical path:** Client lookup → Slot query → Conflict detection → Booking creation → Confirmation response

This 5-step path is the entire reason the platform exists. Everything else serves or enriches this path.

---

## MVP Recommendation

### Must-have for MVP (table stakes only)

**Identity & Clients**
1. Client registration + lookup by phone (upsert pattern)
2. Basic profile (name, phone, email)

**Services Catalog**
3. Service listing with duration and price
4. Service-to-professional assignment

**Scheduling Engine**
5. Professional availability configuration (weekly recurring)
6. Available slot query (by date + service + professional)
7. Atomic booking creation with conflict detection
8. Booking confirmation response (structured)
9. Booking lookup by client phone
10. Booking cancellation

**Payment Engine**
11. Payment record with price snapshot at booking time
12. Payment status field (pending/paid/cancelled)

**Conversation Tracking**
13. Session-to-booking linkage on creation

**API Design**
14. Idempotency on booking creation
15. Structured error codes AI can act on

### Recommended differentiators for MVP (high value, low/medium complexity)

16. Client auto-create on booking (eliminates two-step registration)
17. "Next N available slots" query (reduces AI conversation turns significantly)
18. Conflict explanation in error responses (AI phrases response better)

### Defer to post-MVP

| Feature | Reason to Defer |
|---------|-----------------|
| Booking intent/hold (slot reservation) | High complexity; solve by making booking fast enough |
| Rescheduling (atomic cancel+rebook) | Can be done client-side as two calls initially |
| Waitlist | Complex state machine; low immediate need |
| Recurring appointments | Complex; not needed for AI conversation flow |
| Multi-service single appointment | Requires sequential slot math; defer |
| Webhook events | Useful but not blocking AI consumption |
| Manager reporting/dashboard | Day-2 concern; booking data supports ad-hoc queries |
| Google Calendar sync | OAuth complexity; not needed for launch |
| No-show tracking | Operational; can be added to booking model later |

---

## Confidence Assessment

| Area | Confidence | Basis |
|------|------------|-------|
| Table stakes identification | HIGH | Well-established scheduling software patterns; Calendly, Acuity, Square Appointments, Fresha all converge on these features |
| AI agent ergonomics differentiators | MEDIUM | Based on API design principles and knowledge of AI agent patterns |
| Beauty salon domain specifics | MEDIUM | General knowledge of salon operations |
| Anti-features list | HIGH | Industry-wide pattern of scope creep in booking platforms |
| MVP scoping | MEDIUM | Informed by project context (replacing mock TRANSFORM capabilities) |

---
*Research completed: 2026-03-13*
