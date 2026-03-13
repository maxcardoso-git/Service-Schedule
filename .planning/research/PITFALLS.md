# Pitfalls Research — AI Scheduling Platform

## Critical Pitfalls (Cause Rewrites or Double-Bookings)

### 1. Race Conditions / TOCTOU on Slot Availability

**Problem:** Two AI agents check same slot simultaneously, both see "available", both create bookings → double-booking.

**Warning Signs:**
- Slot availability check and booking creation are separate, non-atomic operations
- No database-level constraint preventing overlapping bookings
- Tests pass but production with concurrent users fails

**Prevention Strategy:**
- Use PostgreSQL exclusion constraint or partial unique index on `(professional_id, date, start_time)` for active bookings
- `SELECT FOR UPDATE SKIP LOCKED` in booking creation transaction
- Never trust application-level locks alone

**Phase:** Scheduling Engine (Phase 2)

---

### 2. TTL Hold Expiry via Polling Instead of Filtering

**Problem:** Pre-reservation expires but row stays in DB with PRE_RESERVED status. Subsequent availability queries still see slot as occupied until cleanup job runs.

**Warning Signs:**
- Availability queries don't filter by `expiresAt`
- Cleanup cron runs every 60s but AI agent gets "no slots" for already-expired holds
- Stale pre-reservations accumulate

**Prevention Strategy:**
- All availability queries MUST include `WHERE (status != 'PRE_RESERVED' OR expires_at > NOW())`
- Treat expired pre-reservations as non-existent at query time
- Cleanup cron is cosmetic (marks expired rows), not functional (availability doesn't depend on it)

**Phase:** Scheduling Engine (Phase 2)

---

### 3. Duration Overlap Detection with Point Equality

**Problem:** Checking `start_time = requested_time` misses overlaps. A 60-min booking at 14:00 blocks 14:00-15:00, but point check at 14:30 passes.

**Warning Signs:**
- Conflict check uses `WHERE start_time = $1` instead of interval overlap
- Bookings with different start times but overlapping durations both succeed
- Works with fixed 30-min slots but breaks with variable durations

**Prevention Strategy:**
- Use interval overlap formula: `existing_start < new_end AND existing_end > new_start`
- Store both `startTime` and `endTime` on booking (calculated from service duration)
- Test with overlapping scenarios: 14:00-15:00 vs 14:30-15:30

**Phase:** Scheduling Engine (Phase 2)

---

### 4. Timezone Handling

**Problem:** Storing times as naive timestamps. Server in UTC, salon in BRT (UTC-3). 14:00 BRT stored as 14:00 UTC = wrong by 3 hours.

**Warning Signs:**
- Using `TIMESTAMP` instead of `TIMESTAMPTZ` in PostgreSQL
- Date calculations produce off-by-one errors around midnight
- Daylight saving time transitions break slot generation

**Prevention Strategy:**
- Always use `TIMESTAMPTZ` in PostgreSQL
- Store all times in UTC internally
- Convert to/from salon timezone at API boundary only
- Store salon timezone in configuration (e.g., `America/Sao_Paulo`)
- Test with DST transition dates

**Phase:** Foundation (Phase 1) — set timezone strategy from day one

---

### 5. Working Hours End-of-Day Overrun

**Problem:** Professional works until 18:00. Service takes 60 min. System offers 17:30 slot → appointment runs until 18:30, past working hours.

**Warning Signs:**
- Last slot offered is `work_end - slot_increment` instead of `work_end - service_duration`
- Professionals complain about late appointments
- Slot generation doesn't account for service duration at boundaries

**Prevention Strategy:**
- Slot generation: last possible start = `work_end - service_duration - buffer_time`
- Validate: `slot_start + service_duration + buffer <= work_end`
- Test edge case: service duration > remaining time window

**Phase:** Scheduling Engine (Phase 2)

---

### 6. Multi-Service Booking Treated as Independent Slots

**Problem:** Client books hair (60 min) + nails (30 min). System treats as two independent bookings, potentially with different professionals or non-sequential times.

**Warning Signs:**
- No concept of "booking group" or multi-service session
- Client gets confirmation for 14:00 hair and 16:00 nails (gap)
- No way to cancel/reschedule a multi-service booking atomically

**Prevention Strategy:**
- Design `BookingService` (one-to-many from Booking) from day one, even if MVP only supports single service
- Booking is the session, services are line items
- For MVP: restrict to 1 service per booking, but schema supports N

**Phase:** Foundation schema design (Phase 1)

---

## Moderate Pitfalls (Cause Delays or Tech Debt)

### 7. AI Agent Concurrent Requests Without Idempotency

**Problem:** AI agent timeout → retry → two pre-reservations created for same intent. Agent doesn't know which one to confirm.

**Warning Signs:**
- No idempotency key on booking creation endpoint
- Duplicate bookings in database with same client + service + time
- Agent error handling creates multiple bookings

**Prevention Strategy:**
- Accept optional `idempotencyKey` on `POST /bookings/pre-reserve`
- If key exists with valid booking, return existing (200, not 201)
- Store idempotency keys with TTL (e.g., 10 minutes)

**Phase:** Scheduling Engine (Phase 2)

---

### 8. Availability Query Performance Degradation

**Problem:** As bookings grow, slot availability query gets slow. AI conversation stalls for seconds waiting for response.

**Warning Signs:**
- Availability endpoint >500ms response time
- Full table scan on bookings table for each availability check
- No index on `(professional_id, date, status)`

**Prevention Strategy:**
- Composite index: `(professional_id, start_time, end_time)` filtered by active statuses
- Limit date range queries (max 7 days per request)
- Consider caching working hours (rarely change)

**Phase:** Scheduling Engine (Phase 2) — add indexes from first migration

---

### 9. PIX Payment Hold Window Too Tight

**Problem:** Pre-reservation TTL is 5 minutes. PIX payment takes 2-3 minutes. By the time payment confirms, slot expired.

**Warning Signs:**
- Booking status changes to EXPIRED between payment creation and payment confirmation
- Agent gets "booking expired" error after client already paid
- Support issues with "I paid but booking disappeared"

**Prevention Strategy:**
- Extend pre-reservation TTL when payment is initiated (e.g., reset to 10 minutes)
- Or: allow payment confirmation to reactivate expired pre-reservation if slot still available
- Track payment initiation timestamp to distinguish "never paid" vs "paying"

**Phase:** Payment Engine (Phase 3)

---

### 10. Conversation Tracking Conflated with Booking State

**Problem:** Conversation tracking stored directly on booking model. If conversation tracking fails, booking creation fails.

**Warning Signs:**
- `conversationId` is a required field on booking
- Booking creation fails when OrchestratorAI doesn't provide conversationId
- Booking model has conversation-specific fields (channel, agentId) mixed with booking fields

**Prevention Strategy:**
- Separate `ConversationLink` table: `(bookingId, conversationId, agentId, channel, createdAt)`
- `conversationId` is optional on booking creation
- Conversation tracking failures logged but don't block booking

**Phase:** Conversation Tracking (Phase 4) — keep separate from booking model

---

### 11. No Distinction Between "No Slots" and "Not Working That Day"

**Problem:** Availability endpoint returns empty array for both "all slots taken" and "professional doesn't work Sundays". AI agent can't give helpful response.

**Warning Signs:**
- AI says "no availability" when professional is simply off that day
- Client keeps asking about different times on a non-working day
- No way to suggest "try Monday instead"

**Prevention Strategy:**
- Return structured response: `{ available: false, reason: "NOT_WORKING_DAY" | "FULLY_BOOKED" | "NO_SERVICE", nextAvailable: "2026-03-14" }`
- Include `workingHours` for the requested date in response (null if not working)
- AI agent can say "Professional doesn't work Sundays, next available Monday at 9am"

**Phase:** Scheduling Engine (Phase 2) — design response shape early

---

## Minor Pitfalls (Fixable Friction)

### 12. Slot Increment Granularity Mismatch

**Problem:** Slots generated in 30-min increments but service takes 45 min. 9:00, 9:30, 10:00 offered → 9:00-9:45 blocks 9:30 slot but system doesn't recalculate.

**Prevention:** Calculate available windows dynamically, not fixed grid. Offer slots where `service_duration` fits without overlapping any existing booking.

### 13. Missing Audit Trail for Booking State Changes

**Problem:** Booking status changes (PRE_RESERVED → CONFIRMED → CANCELLED) with no record of who/when/why. Disputes are unresolvable.

**Prevention:** Create `BookingEvent` table: `(bookingId, fromStatus, toStatus, actor, reason, timestamp)`. Log every state transition.

### 14. No Buffer Time Between Appointments

**Problem:** 60-min service ends at 15:00, next starts at 15:00. Professional has zero transition time.

**Prevention:** Configurable buffer per professional or per service. Default 10-15 min. Factor into slot calculation: `slot_end = start + duration + buffer`.

### 15. AI Agent Confirms Without Verifying Hold Still Valid

**Problem:** Agent calls confirm 6 minutes after pre-reserve. Hold expired at 5 min. Confirm succeeds but slot was given to someone else.

**Prevention:** Confirm endpoint must check: (a) booking exists, (b) status is PRE_RESERVED, (c) `expiresAt > NOW()`. Return clear error if expired with suggestion to re-reserve.

---

## Summary by Phase

| Phase | Critical Pitfalls | Moderate Pitfalls | Minor Pitfalls |
|-------|------------------|-------------------|----------------|
| Phase 1: Foundation | #4 Timezone, #6 Multi-service schema | — | — |
| Phase 2: Scheduling Engine | #1 Race conditions, #2 TTL expiry, #3 Duration overlap, #5 End-of-day | #7 Idempotency, #8 Performance, #11 No-slots reason | #12 Granularity, #14 Buffer time, #15 Expired hold |
| Phase 3: Payment Engine | — | #9 PIX hold window | — |
| Phase 4: Conversation Tracking | — | #10 Separate from booking | #13 Audit trail |

**Highest risk phase:** Phase 2 (Scheduling Engine) — 4 critical pitfalls. Design slot generation and conflict detection carefully.

---

## Confidence Assessment

| Area | Confidence | Basis |
|------|------------|-------|
| Race condition / double-booking patterns | HIGH | Well-documented in booking system literature |
| TTL and expiry patterns | HIGH | Standard distributed systems pattern |
| Duration overlap math | HIGH | Classic interval overlap problem |
| Timezone pitfalls | HIGH | Universal scheduling system issue |
| PIX-specific timing | MEDIUM | Brazil-specific payment flow, timing estimates approximate |

---
*Research completed: 2026-03-13*
