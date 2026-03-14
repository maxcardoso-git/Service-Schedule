# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-14)

**Core value:** Permitir que agentes de IA realizem todas as operações de agenda de forma autônoma, com rastreabilidade conversacional e interface administrativa para operação humana.
**Current focus:** v2.0 Frontend — Phase 5 (Frontend Foundation + Auth)

## Current Position

Phase: 5 of 8 (Frontend Foundation + Auth)
Plan: 2 of 7 complete
Status: In progress
Last activity: 2026-03-14 — Completed 05-02-PLAN.md (Admin API endpoints: user CRUD, client list, booking status, dashboard stats)

Progress: [############░░░░░░░░] 57% (v1.0 complete, v2.0 plans 05-01, 05-02 done)

## Milestone Summary

**v1.0 AI Scheduling API — SHIPPED 2026-03-13**
- 4 phases, 11 plans, 28 requirements, ~53 min
- See: .planning/MILESTONES.md

**v2.0 Frontend — IN PROGRESS**
- 4 phases (5-8), 26 requirements
- Admin dashboard + Receptionist interface

## Performance Metrics

**Velocity (v1.0):**
- Total plans completed: 11
- Average duration: ~4.8 min
- Total execution time: 53 min

## Accumulated Context

### Decisions

All v1.0 decisions logged in PROJECT.md Key Decisions table.

- Backend runs on Express + Prisma + PostgreSQL at port 3150 on VPS 72.61.52.70
- API Key auth for agents, JWT for admin users
- All columns camelCase (no @map in Prisma)
- Prisma migrate workflow (not db push)
- v2.0: React 19 + Vite 8 + shadcn/ui + TanStack Query + FullCalendar 6
- v2.0: Express serves static files (single PM2 process, no separate frontend server)
- v2.0: AdminUser gains role field (ADMIN, RECEPTIONIST) via migration
- Two-migration strategy: initial ADMIN default (existing users), then RECEPTIONIST default (new users)
- requireRole(...roles) middleware pattern for protecting admin-only endpoints
- CORS: origin false in production (same-origin static serve), localhost:5173 in dev
- requireRole('ADMIN') on user management only; client/booking/dashboard accessible to all authenticated admins
- updateBookingStatus: no transition guard (simple admin override, business rules added when needed)

### Pending Todos

None.

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-03-14
Stopped at: Completed 05-02-PLAN.md, ready for 05-03
Resume file: None
