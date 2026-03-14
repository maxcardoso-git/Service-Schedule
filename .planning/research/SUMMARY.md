# Project Research Summary

**Project:** Service-schedule v2.0 Frontend
**Domain:** Beauty salon scheduling -- admin dashboard + receptionist interface (SPA frontend for existing Express API)
**Researched:** 2026-03-13
**Confidence:** HIGH

## Executive Summary

Service-schedule v2.0 adds a React SPA frontend to an already-shipped Express REST API (v1.0) that currently serves only AI agents via OrchestratorAI. The recommended approach is a single React 19 application with role-filtered routes (admin vs receptionist), served as static files from Express in production. The stack mirrors OrchestratorAI's toolchain (React, shadcn/ui, TanStack Query, Zustand, react-hook-form) with version upgrades appropriate for a greenfield project (Tailwind v4, React 19, Vite 8). FullCalendar v6 is the calendar library of choice for the scheduling views. The team already knows this entire stack -- zero new paradigms to learn.

The existing API was designed for agent consumption: no CORS, no role-based access, no pagination, no frontend-specific data shapes. The biggest risk is not the frontend itself but the backend adaptations required to serve a browser-based client. Three critical pitfalls (missing AdminUser role field, frontend-only authorization, no CORS) must be resolved before any React component is written. A fourth critical risk -- calendar library lock-in -- requires a prototype spike early in development to validate FullCalendar meets the salon's specific scheduling view needs.

The frontend splits naturally into 4 phases: foundation/auth, entity management (services/professionals), booking management with receptionist interface, and calendar/dashboard polish. Seven backend gaps have been identified (role field, client list endpoint, status transitions, reschedule endpoint, dashboard aggregation, user management, admin booking endpoints). These gaps must be addressed in lockstep with the frontend phases that consume them. The receptionist interface must be designed as its own experience -- not a feature-reduced admin panel.

## Key Findings

### Recommended Stack

The stack is high-confidence because every technology is already in use in OrchestratorAI, upgraded to current stable versions for this greenfield project. See [STACK.md](STACK.md) for full rationale, version pins, and installation commands.

**Core technologies:**
- **React 19.2 + Vite 8**: Stable 15+ months. Greenfield project, no reason to start on older versions. Vite 8 uses Rolldown bundler.
- **shadcn/ui + Tailwind CSS v4**: Same component system as OrchestratorAI. Source-owned components, no heavy library dependency. Full React 19 + Tailwind v4 compatibility confirmed.
- **FullCalendar v6**: Industry standard for scheduling UIs (19K+ GitHub stars, 1M+ weekly downloads). Free tier covers day/week/list views and drag-and-drop. Resource columns (per-professional) are premium ($499/yr) but not needed for MVP -- use filter dropdown.
- **TanStack Query v5 + Zustand v5**: Server state (bookings, services) in TanStack Query with 30s polling for calendar freshness. Client state (filters, view mode, auth session) in Zustand.
- **react-hook-form + Zod**: Same form stack as OrchestratorAI and backend. Zod schemas can eventually be shared.
- **date-fns v4**: Tree-shakeable, pt-BR locale support. Backend uses v3 -- no breaking changes.
- **Native fetch**: No axios. Thin `apiFetch` wrapper handles JWT auth headers and 401 redirect.

**Explicitly rejected:** Next.js/Remix (over-engineered for dashboard SPA), Ant Design/MUI (different design system, heavyweight), Redux (overkill -- Zustand + TanStack Query covers everything), TypeScript (maintain JS consistency with OrchestratorAI), axios (unnecessary), WebSockets (overkill for 1-3 concurrent users), FullCalendar resource plugins (premium, not needed for MVP).

### Expected Features

See [FEATURES.md](FEATURES.md) for full analysis with complexity ratings, backend support status, and dependency diagram.

**Must have (table stakes) -- 15 features ordered by dependency:**
1. Auth with role-based access (admin vs receptionist) -- gates everything
2. Admin user management (create receptionist accounts)
3. Services CRUD UI (table + create/edit/deactivate)
4. Professionals CRUD + working hours + service assignment
5. Calendar view (day + week) with per-professional filtering
6. Booking creation flow (client search/create -> service -> professional -> slot -> confirm)
7. Booking status management (confirm, cancel, complete, no-show)
8. Client search, registration, and appointment history
9. Receptionist today view (daily agenda grouped by professional)
10. Receptionist quick booking (streamlined 3-step flow)

**Should have (high-value, low-effort differentiators):**
- Color-coded booking statuses on calendar (pure frontend, zero backend work)
- Booking notes field (schema already supports it)
- Payment status badge (data already linked)
- Quick client history popup (endpoint exists)
- Dashboard KPI cards (needs one aggregation endpoint)

**Defer to post-MVP:**
- Drag-and-drop rescheduling, professional utilization analytics, responsive tablet layout, print agenda, bulk working hours template

**Anti-features (explicitly do NOT build):**
- Online client self-booking portal (AI agent IS the client channel)
- SMS/WhatsApp notifications (OrchestratorAI handles this)
- Loyalty programs, inventory, financial reports, multi-location, payroll, recurring appointments, waitlist, dynamic pricing, real-time WebSocket updates

### Architecture Approach

Single React SPA in a `frontend/` directory with its own `package.json`, served as static files by Express in production. One PM2 process. Vite dev server with API proxy in development. Role-based routing within a single app -- not two separate apps. Frontend calls dedicated `/api/admin/*` endpoints; existing agent endpoints remain untouched. Business logic stays server-side; the frontend never calculates slots or validates conflicts locally. See [ARCHITECTURE.md](ARCHITECTURE.md) for full component structure, data flow, and anti-patterns.

**Major components:**
1. **API Client Layer** (`api/` + `hooks/`) -- `apiFetch` wrapper with JWT auth, TanStack Query hooks per entity, 401 interceptor with login redirect
2. **Admin Shell** -- sidebar navigation, CRUD pages for services/professionals/clients/users, calendar, dashboard
3. **Receptionist Shell** -- separate layout optimized for speed: today's agenda, quick booking wizard, client lookup (designed independently, NOT a stripped-down admin)
4. **Shared Components** -- BookingCard, ClientSearch, StatusBadge, forms via shadcn/ui primitives
5. **New Backend Admin Routes** -- `/api/admin/bookings` (paginated/filterable), `/api/admin/clients` (paginated/searchable), `/api/admin/dashboard/summary`, `/api/admin/users`

**Key architectural rules:**
- Both frontend and AI agents call the same service layer; routes differ but business logic is shared
- Create NEW endpoints under `/api/admin/` for frontend -- do NOT modify existing agent endpoints
- Admin endpoints return denormalized data (booking with client name, service name, professional name in one response)
- Frontend is UX-only for authorization; backend `requireRole()` middleware enforces security

### Critical Pitfalls

See [PITFALLS.md](PITFALLS.md) for all 16 pitfalls with detailed prevention strategies and phase assignments.

1. **No role field on AdminUser** -- JWT hardcodes `role: 'admin'`. Must add role column + migration as the very first v2.0 task. Everything else depends on it.
2. **Frontend-only authorization** -- `adminAuth` middleware checks JWT validity but never checks role. Receptionist can call admin-only endpoints via direct API call. Must add `requireRole()` middleware before exposing any route.
3. **No CORS on existing API** -- API was built for server-to-server calls. Browser requests will fail silently. Add `cors` middleware before any frontend development.
4. **Calendar library lock-in** -- Wrong library choice is expensive to reverse. Build a prototype with real data (3+ professionals, 20+ bookings) before full commitment to FullCalendar.
5. **Optimistic updates causing ghost bookings** -- Do NOT use optimistic updates for booking creation. Use loading state + server confirmation. Bookings are high-stakes; showing false success is worse than a spinner.

## Implications for Roadmap

Based on combined research, the dependency chain is clear. Four phases, each delivering usable functionality.

### Phase 1: Foundation and Auth

**Rationale:** Three critical pitfalls (#1 role field, #2 backend auth, #3 CORS) and four moderate pitfalls (#6 API shape, #7 token refresh, #10 VPS routing, #11 date/time) all live here. Nothing else can proceed until auth works end-to-end and the integration pattern is proven.

**Delivers:** Working login, role-based routing, admin user management page (proves full CRUD cycle), deployment infrastructure, API client pattern with 401 handling, date utility functions, booking status config constant.

**Addresses features:** Login page + session management, role-based access control, admin user management.

**Avoids pitfalls:** #1 (no role field), #2 (frontend-only auth), #3 (no CORS), #6 (API shape mismatch), #7 (token refresh), #10 (VPS routing), #11 (date/time), #12 (status config), #16 (reuse OrchestratorAI patterns).

**Backend work required:**
- Add `role` to AdminUser schema + Prisma migration
- Update JWT payload to include dynamic role from DB
- Add `requireRole()` middleware
- Add CORS middleware
- Create `/api/admin/users` CRUD endpoints
- Add static file serving to `app.js` (production mode)

### Phase 2: Service and Professional Management

**Rationale:** Simplest CRUD pages, using mostly existing backend endpoints. Establishes the table + form component patterns (shadcn DataTable, react-hook-form modals) that all subsequent pages will follow. Provides reference data (services, professionals, working hours) that the booking flow needs.

**Delivers:** Services CRUD UI (table + create/edit/deactivate), Professionals CRUD UI with working hours weekly grid and service assignment multi-select.

**Addresses features:** Services CRUD, Professionals CRUD, professional-service assignment, working hours management.

**Avoids pitfalls:** None critical -- low-risk phase with well-established patterns.

**Backend work required:** Minimal -- possibly add pagination to existing service/professional list endpoints if not present.

### Phase 3: Booking Management and Receptionist Interface

**Rationale:** Highest-value phase. The booking creation flow, status management, and receptionist daily view are the core product. Requires the most new backend endpoints. The receptionist interface must be designed independently -- not derived from the admin UI (pitfall #8). This is where the frontend becomes genuinely useful.

**Delivers:** Daily agenda view (receptionist primary screen), booking creation wizard (client lookup -> service -> professional -> slot -> confirm), booking status transitions (complete, no-show, cancel), client search/registration/history, receptionist quick booking flow, booking notes, payment status badge.

**Addresses features:** Create booking, cancel booking, booking status transitions, today's agenda, quick booking flow, client search, client registration, client history, booking notes, payment status badge.

**Avoids pitfalls:** #5 (no optimistic updates for booking creation -- use loading + confirmation), #8 (receptionist as separate design), #13 (search debounce on client lookup), #15 (real-time form validation -- filter services by professional, fetch slots on selection).

**Backend work required:**
- `GET /api/admin/bookings` (paginated, filterable by date/status/professional/client)
- `GET /api/admin/bookings/:id` (detail with client, professional, service, payment data)
- `PATCH /api/admin/bookings/:id/status` (complete, no-show transitions)
- `GET /api/admin/clients` (paginated, searchable by name/phone)
- `GET /api/admin/clients/:id/bookings` (appointment history)

### Phase 4: Calendar View and Dashboard

**Rationale:** Calendar and dashboard are high-value polish features but not blocking. The receptionist can work from the daily view (Phase 3). The admin can work from the booking list (Phase 3). Calendar requires FullCalendar integration -- prototype spike should happen at the start of this phase. Dashboard needs one aggregation endpoint.

**Delivers:** Weekly/daily calendar with per-professional filtering, color-coded booking statuses, click-to-view-details on calendar events, dashboard KPI cards (booking count, revenue, no-show rate, occupancy), quick client history popup on booking cards.

**Addresses features:** Calendar view (day + week), color-coded statuses, dashboard KPI cards, quick client history popup.

**Avoids pitfalls:** #4 (calendar library lock-in -- prototype with real data first), #5 (pending visual state for drag interactions, not optimistic), #9 (short staleTime 30s + refetchInterval 60s + refetchOnWindowFocus for calendar), #14 (loading/empty/error states on all views).

**Backend work required:**
- `GET /api/admin/dashboard/summary` (today's booking count, revenue, upcoming count, no-show rate)
- Verify booking list endpoint supports date range filtering for calendar data source

### Phase Ordering Rationale

- **Auth first** because 3 critical pitfalls block everything and the entire UI depends on role-based access. The existing API has zero browser-client support.
- **Entity management second** because it uses existing endpoints, establishes reusable component patterns, and provides reference data that booking forms depend on.
- **Booking/receptionist third** because it is the core product value, requires the most new backend work, and benefits from patterns established in Phase 2.
- **Calendar/dashboard last** because they are enhancements over the daily view and booking list. They can ship independently without blocking receptionist workflows. Calendar library risk is isolated to this phase.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1:** VPS deployment infrastructure alongside OrchestratorAI needs concrete nginx/PM2 configuration. The serving strategy (Express static vs separate nginx) should be finalized.
- **Phase 3:** Booking creation wizard UX -- multi-step form with dependent field validation (professional filters services, service + date fetches slots) is complex interaction design. Consider researching react-hook-form multi-step patterns.
- **Phase 4:** FullCalendar integration needs a prototype spike with real data. Verify: timegrid styling with Tailwind, event click handlers, date range event source, professional filter integration, and whether the free tier is truly sufficient.

Phases with standard patterns (skip deep research):
- **Phase 2:** CRUD table + form is established. shadcn DataTable + react-hook-form modals. Team has done this in OrchestratorAI. No surprises expected.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All versions verified via npm. Team already uses this stack in OrchestratorAI. React 19, Vite 8, Tailwind v4 all stable 12+ months. |
| Features | MEDIUM-HIGH | Table stakes verified across 9 salon software platforms. Backend gaps identified by direct schema/route analysis. MVP ordering could shift based on team priorities. |
| Architecture | HIGH | Standard SPA + REST API pattern. Serving strategy, project structure, auth flow, API client pattern all well-established. Verified against Vite docs and Express static serving patterns. |
| Pitfalls | HIGH | Critical pitfalls verified by reading actual source code (`AdminUser` has no role, JWT hardcodes 'admin', no CORS middleware). These are facts, not speculation. |

**Overall confidence:** HIGH

### Gaps to Address

- **Calendar library validation:** FullCalendar is recommended but not prototyped with this project's data. Build a spike with 3+ professionals and 20+ bookings before full commitment in Phase 4.
- **AdminUser role migration:** Schema change has not been written yet. Must be the first migration of v2.0.
- **Client list endpoint:** `GET /api/clients` with pagination/search does not exist. Must be built for Phase 3.
- **Booking status transition endpoint:** No generic status change endpoint exists. Need `PATCH /api/admin/bookings/:id/status` for Phase 3.
- **Dashboard aggregation query:** No summary endpoint exists. Need to design the query for Phase 4.
- **VPS deployment alongside OrchestratorAI:** Nginx configuration for multiple apps on same VPS (72.61.52.70) not yet planned. Resolve in Phase 1.
- **CORS middleware:** Confirmed missing from current backend middleware. Must be added in Phase 1 before any frontend work begins.
- **Reschedule endpoint:** `PUT /api/bookings/:id` for changing time/professional does not exist. Needed if drag-and-drop is added post-MVP.

## Sources

### Primary (HIGH confidence)
- Project source code: `src/middleware/auth.js`, `src/routes/admin/auth.js`, `prisma/schema.prisma`, `src/app.js`
- [React 19 stable release](https://react.dev/blog/2024/12/05/react-19)
- [Vite releases](https://vite.dev/releases)
- [FullCalendar React docs](https://fullcalendar.io/docs/react)
- [TanStack Query overview](https://tanstack.com/query/latest)
- [Tailwind CSS v4 release](https://tailwindcss.com/blog/tailwindcss-v4)
- [shadcn/ui React 19 + Tailwind v4 support](https://ui.shadcn.com/docs/react-19)
- npm registry (direct version verification via `npm view`)

### Secondary (MEDIUM confidence)
- Salon software feature comparisons: [Zylu](https://zylu.co/10-must-have-features-salon-software-management-2026/), [Mangomint](https://www.mangomint.com/blog/salon-software-features/), [Zenoti](https://www.zenoti.com/salon-management-software), [Booknetic](https://www.booknetic.com/blog/essential-online-booking-system-features), [TheSalonBusiness](https://thesalonbusiness.com/best-salon-software/)
- [React calendar component comparisons (DHTMLX)](https://dhtmlx.com/blog/best-react-scheduler-components-dhtmlx-bryntum-syncfusion-daypilot-fullcalendar/)
- [TanStack Query optimistic updates (TkDodo)](https://tkdodo.eu/blog/concurrent-optimistic-updates-in-react-query)
- [RBAC in Node.js and React](https://medium.com/@ignatovich.dm/implementing-role-based-access-control-rbac-in-node-js-and-react-c3d89af6f945)
- [Vite backend integration guide](https://vite.dev/guide/backend-integration)
- [React + Express + Vite same port pattern](https://dev.to/herudi/single-port-spa-react-and-express-using-vite-same-port-in-dev-or-prod-2od4)

---
*Research completed: 2026-03-13*
*Ready for roadmap: yes*
