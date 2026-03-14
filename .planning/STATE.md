# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-14)

**Core value:** Permitir que agentes de IA realizem todas as operações de agenda de forma autônoma, com rastreabilidade conversacional e interface administrativa para operação humana.
**Current focus:** v2.0 Frontend — Phase 6 (Scheduling UI)

## Current Position

Phase: 6 of 8 (Services + Professionals Management) — In progress
Plan: 1 of 3 complete
Status: In progress
Last activity: 2026-03-14 — Completed 06-01-PLAN.md (Services CRUD page + backend list endpoint)

Progress: [####################░░] 80% (v1.0 complete, v2.0 Phase 5 complete, Phase 6 plan 1 done)

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

- Active toggle reuses PUT /:id with { active: bool } rather than dedicated PATCH endpoint (minimal API surface)
- GET route placed before PUT /:id in services router to avoid Express route conflicts
- serviceBodySchema extended with active: z.boolean().optional() at schema level (all routes benefit)

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
- @tailwindcss/vite requires --legacy-peer-deps with Vite 8 (peer dep range not updated yet, functionally compatible)
- shadcn style: base-nova (default); JSX not TypeScript; button uses @base-ui/react primitive
- shadcn add uses -o (overwrite) flag, not --force (removed in shadcn@4)
- apiFetch prepends /api internally — callers pass paths without /api prefix
- JWT decoded client-side with atob + JSON.parse (no external JWT library)
- ProtectedRoute uses Outlet pattern for composability
- useAuthStore.getState() for imperative access (apiFetch, login handler), useAuthStore(selector) for reactive reads
- Controlled dialog open state (open + onOpenChange) instead of DialogTrigger — required for pre-populating dialogs with row data
- Separate inline toggle mutation from dialog mutation — one-click UX for common active/inactive toggle
- CRUD page pattern: useQuery fetch + useMutation POST/PATCH + invalidateQueries(['queryKey']) + toast
- Production static serving: express.static(frontend/dist) + GET * SPA fallback with /api guard, gated on NODE_ENV=production
- ESM __dirname: path.dirname(fileURLToPath(import.meta.url)) inside the production block (scoped, not top-level)

### Pending Todos

None.

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-03-14T18:24:12Z
Stopped at: Completed 06-01-PLAN.md — Services CRUD page and backend list endpoint done.
Resume file: None
