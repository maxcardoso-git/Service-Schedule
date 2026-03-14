# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-14)

**Core value:** Permitir que agentes de IA realizem todas as operações de agenda de forma autônoma, com rastreabilidade conversacional e interface administrativa para operação humana.
**Current focus:** v2.0 Frontend — COMPLETE

## Current Position

Phase: 8 of 8 (Receptionist Interface) — Phase complete
Plan: 1 of 1 complete
Status: ALL PHASES COMPLETE — v2.0 Frontend milestone shipped
Last activity: 2026-03-14 — Completed 08-01-PLAN.md (Receptionist page, 3-step booking dialog, /receptionist route)

Progress: [████████████████████████████] 100% (v1.0 complete, v2.0 Phases 5-8 complete)

## Milestone Summary

**v1.0 AI Scheduling API — SHIPPED 2026-03-13**
- 4 phases, 11 plans, 28 requirements, ~53 min
- See: .planning/MILESTONES.md

**v2.0 Frontend — SHIPPED 2026-03-14**
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
- GET /admin/professionals route placed before /:id to prevent Express treating bare "/" as UUID param
- ServiceAssignmentDialog fetches /admin/services with graceful error state for wave-1 parallel execution
- assignProfessional state stores full professional object so dialog shows current assignments without extra fetch
- DAY_DISPLAY_ORDER [1,2,3,4,5,6,0] for Mon-first grid while preserving 0-6 dayOfWeek stored values
- defaultHours() factory (not constant) to ensure fresh mutable array per dialog open
- Only enabled days sent in PUT /working-hours payload — backend does full replacement implicitly clearing disabled days
- Revenue uses BookingService.price (price at booking time) not Service.price (current catalog) — correct for financial accuracy
- revenueToday via $queryRaw SUM — Prisma ORM lacks join-based aggregation, raw SQL needed
- occupancyPercent: (non-cancelled bookings / activeProfessionals * 16 slots) * 100, capped at 100 — simple dashboard approximation
- by-phone route placed before /:id/appointments — prevents Express treating literal "by-phone" as UUID param
- Admin availability+create endpoints are JWT-auth mirrors of apiKey routes — same bookingService functions, different middleware
- Debounced search: controlled input + useEffect setTimeout(300) updating separate searchTerm state that drives useQuery key
- staleTime: 0 on availability queries — slot availability changes between requests, always fresh
- crypto.randomUUID() for idempotencyKey on each confirm click — prevents duplicate bookings on retry
- Multi-step booking dialog: step state (1-5) with conditional render per step, Back button on steps 2-5, reset on dialog close
- FullCalendar locale must be imported as object from @fullcalendar/core/locales/pt-br (not passed as string prop)
- FullCalendar extendedProps.booking carries full booking object for event click handlers
- STATUS_TRANSITIONS map (object keyed by status) replaces switch/if chains for reachable-states logic
- Fetch all bookings without date filter for small salon — TODO added for future date-range scale
- Dashboard 2-row layout: 4-col primary KPIs (bookings, revenue, no-shows, occupancy) + 3-col secondary
- STATUS_COLORS/LABELS/TRANSITIONS copied into Receptionist.jsx (not imported from Calendar.jsx — page file, not shared)
- RootRedirect inline component in App.jsx: RECEPTIONIST role -> /receptionist, otherwise Dashboard
- Receptionist 3-step dialog combines NewBookingDialog steps 2-4 into one scrollable step (service + professional + date+slot)
- RECEPTIONIST ProtectedRoute sibling to ADMIN block inside AppLayout children

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

Last session: 2026-03-14T20:37:04Z
Stopped at: Completed 08-01-PLAN.md — Receptionist page, ReceptionistBookingDialog, App.jsx route. v2.0 milestone complete.
Resume file: None
