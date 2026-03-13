# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-13)

**Core value:** Permitir que agentes de IA realizem todas as operações de agenda de forma autônoma, com rastreabilidade conversacional.
**Current focus:** Phase 1 — Foundation + Identity + Catalog

## Current Position

Phase: 1 of 4 (Foundation + Identity + Catalog)
Plan: 2 of 4 in current phase
Status: In progress
Last activity: 2026-03-13 — Completed 01-02-PLAN.md (Auth Infrastructure and Seed Data)

Progress: [██░░░░░░░░] 20% (2/10 plans complete)

## Performance Metrics

**Velocity:**
- Total plans completed: 2
- Average duration: 4 min
- Total execution time: 8 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| Phase 1 | 2/4 | 8 min | 4 min |

**Recent Trend:**
- Last 5 plans: 01-01 (4 min), 01-02 (4 min)
- Trend: steady

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap]: 4-phase structure derived from 5 domain components; Phases 3 and 4 can overlap after Phase 2 completes
- [Phase 1]: TIMESTAMPTZ + UTC storage strategy must be set in first migration — never retrofitted
- [Phase 1]: BookingService one-to-many shape designed now even though MVP restricts to single service
- [Phase 2]: Partial unique index on `(professional_id, start_time)` for active bookings — requires raw SQL migration (Prisma DSL limitation)
- [Phase 2]: Slots calculated at query time from working hours, never stored as rows
- [01-02]: AdminUser model added to Prisma schema (not separate config) — consistent Prisma-first pattern
- [01-02]: Health check always returns 200 even if DB disconnected — avoids false-positive LB failures
- [01-02]: apiKeyAuth NOT applied globally — applied per-route in Plans 03/04
- [01-02]: Error envelope `details` field omitted (not null) when not present — cleaner AI agent parsing

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 2 Planning]: `SELECT FOR UPDATE SKIP LOCKED` requires Prisma raw query — validate DDL syntax before writing service layer
- [Phase 2 Planning]: Partial unique index `WHERE status IN (...)` requires raw SQL migration step — flag during plan-phase

## Session Continuity

Last session: 2026-03-13T20:55:00Z
Stopped at: Completed 01-02-PLAN.md — Auth middleware, health check, admin login, seed data complete
Resume file: None
