# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-13)

**Core value:** Permitir que agentes de IA realizem todas as operações de agenda de forma autônoma, com rastreabilidade conversacional.
**Current focus:** Phase 2 — Scheduling Engine

## Current Position

Phase: 2 of 4 (Scheduling Engine)
Plan: 3 of 6 in current phase
Status: In progress
Last activity: 2026-03-13 — Completed 02-03-PLAN.md (Booking HTTP Endpoints and Cron Cleanup)

Progress: [███████░░░] 70% (7/10 plans complete)

## Performance Metrics

**Velocity:**
- Total plans completed: 7
- Average duration: ~4.6 min
- Total execution time: 32 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| Phase 1 | 4/4 | 16 min | 4 min |
| Phase 2 | 3/6 | 16 min | 5.3 min |

**Recent Trend:**
- Last 5 plans: 01-03 (5 min), 01-04 (3 min), 02-01 (12 min), 02-02 (1 min), 02-03 (3 min)
- Trend: 02-03 fast — straightforward HTTP wiring with clear service layer already in place

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap]: 4-phase structure derived from 5 domain components; Phases 3 and 4 can overlap after Phase 2 completes
- [Phase 1]: TIMESTAMPTZ + UTC storage strategy must be set in first migration — never retrofitted
- [Phase 1]: BookingService one-to-many shape designed now even though MVP restricts to single service
- [Phase 2]: Partial unique index on `(professionalId, startTime)` for active bookings — uses camelCase column names (no @map in schema)
- [Phase 2]: Slots calculated at query time from working hours, never stored as rows
- [01-02]: AdminUser model added to Prisma schema (not separate config) — consistent Prisma-first pattern
- [01-02]: Health check always returns 200 even if DB disconnected — avoids false-positive LB failures
- [01-02]: apiKeyAuth NOT applied globally — applied per-route in Plans 03/04
- [01-02]: Error envelope `details` field omitted (not null) when not present — cleaner AI agent parsing
- [01-03]: Phone normalization done in service layer — consistent across all callers
- [01-03]: Prisma P2002 bubbles from createClient to errorHandler unmodified — avoids duplicate catch logic
- [01-03]: asyncHandler pattern established in routes for async Express handlers
- [01-04]: replaceWorkingHours uses full delete+createMany in transaction — simpler, no orphan records
- [01-04]: getServiceById filters professional list to active:true in application layer (not query)
- [01-04]: assignService lets P2002 bubble to errorHandler for 409 — consistent with existing pattern
- [02-01]: Column names in migrations are camelCase (professionalId, startTime) because schema has no @map attributes — db push preserved camelCase field names
- [02-01]: Prisma migrate workflow established via baseline migration — all future schema changes via migrate dev (not db push)
- [02-01]: generateAvailableSlots uses addMinutes cursor loop with slotEnd > workEnd overrun guard — pure function, no DB
- [02-02]: confirmBooking clears expiresAt (sets null) on CONFIRMED — prevents TTL expiry cron from cancelling confirmed bookings
- [02-02]: idempotency key checked via findUnique BEFORE insert; P2002 catch is secondary safety net
- [02-02]: P2002 target inspection uses Array.isArray + join before includes() to safely handle both array and string formats
- [02-03]: GET /by-phone/:phone uses path param (not query) — consistent with clients.js pattern
- [02-03]: startExpiryJob called inside app.listen callback so cron only starts after server is bound
- [02-03]: Cron jobs live in src/jobs/, exported as start*Job() functions

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 2]: `SELECT FOR UPDATE SKIP LOCKED` requires Prisma `$queryRaw` — RESOLVED in 02-02 (implemented and verified)

## Session Continuity

Last session: 2026-03-13T22:19:10Z
Stopped at: Completed 02-03-PLAN.md (Booking HTTP Endpoints and Cron Cleanup)
Resume file: None
