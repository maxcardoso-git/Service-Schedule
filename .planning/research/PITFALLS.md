# Pitfalls Research — Adding React Frontend to Existing Scheduling API

**Domain:** Beauty salon scheduling — admin dashboard + receptionist interface
**Researched:** 2026-03-13
**Focus:** Mistakes specific to adding a frontend to an API-only system

---

## Critical Pitfalls (Cause Rewrites or Broken Access Control)

### 1. AdminUser Model Has No Role Field

**What goes wrong:** The current `AdminUser` model has no `role` column. The JWT login hardcodes `role: 'admin'` in the token payload (see `src/routes/admin/auth.js` line 42). When you add the receptionist role, there is no way to distinguish users without a schema migration. If you build the frontend first and add roles later, every component that checks permissions needs to be retrofitted.

**Warning signs:**
- You start building "receptionist view" components before adding `role` to the database
- All JWT tokens say `role: 'admin'` regardless of who logged in
- `adminAuth` middleware lets everyone through with no role check

**Prevention strategy:**
- First migration of v2.0: add `role` enum (`ADMIN`, `RECEPTIONIST`) to `AdminUser` model with default `ADMIN`
- Update JWT payload to include the actual user role from DB
- Add `requireRole('ADMIN')` middleware for admin-only endpoints before building any frontend
- Seed at least one user of each role for testing

**Phase:** Must be Phase 1 (Foundation/Auth) — everything else depends on it

---

### 2. Frontend-Only Authorization Without Backend Enforcement

**What goes wrong:** You hide UI elements based on role (receptionist cannot see "manage professionals" button), but the backend `/api/admin/*` routes have no role check — just `adminAuth` which verifies the JWT is valid, not what role it carries. A receptionist who knows the API endpoint can call admin-only operations directly. This is a security vulnerability, not just a UX issue.

**Warning signs:**
- `adminAuth` middleware only checks JWT signature, never `req.admin.role`
- Role checks exist only in React components (`{role === 'admin' && <AdminPanel />}`)
- No tests for "receptionist calls admin endpoint and gets 403"

**Prevention strategy:**
- Create `requireRole(...roles)` middleware that checks `req.admin.role` after `adminAuth`
- Apply to every admin-only route: professionals CRUD, services CRUD, user management
- Receptionist routes get their own middleware: `requireRole('ADMIN', 'RECEPTIONIST')`
- Write integration tests: "receptionist hits admin endpoint, expects 403"
- Frontend role checks are for UX only (hide buttons), never for security

**Phase:** Must be Phase 1 — before any route is exposed to the frontend

---

### 3. CORS Not Configured on Existing API

**What goes wrong:** The existing API was built for server-to-server calls (OrchestratorAI agent uses API key). There is no CORS middleware — the API likely returns no `Access-Control-Allow-Origin` header. When the React frontend (running on a different port or subdomain) makes fetch requests, the browser blocks every call. Developers waste hours debugging "network error" that is actually a CORS rejection.

**Warning signs:**
- First API call from React gets `TypeError: Failed to fetch` with no useful error message
- Preflight OPTIONS requests return 404
- Developer adds `"proxy"` to Vite config as a workaround but it breaks in production

**Prevention strategy:**
- Add `cors` middleware to Express immediately, before any frontend work begins
- Configure origin allowlist: development (`http://localhost:5173`) and production domain
- Allow credentials if using httpOnly cookies (though current system uses Bearer tokens in headers)
- Do NOT use `cors({ origin: '*' })` in production — specify exact origins
- Test CORS with a simple fetch from the browser console before building React components

**Phase:** Phase 1 — literally the first backend change

---

### 4. Calendar Library Choice Lock-In

**What goes wrong:** Teams pick a React calendar library (FullCalendar, react-big-calendar, DayPilot, etc.) based on demos, then discover it does not support their specific scheduling needs — e.g., multi-professional column view (side-by-side schedules), drag-to-reschedule with server validation, or proper handling of the salon's timezone. By the time this is discovered, dozens of components are built around the library's API, making replacement extremely costly.

**Warning signs:**
- Choosing a library because the demo looks good, without prototyping YOUR specific views
- Library does not natively support "resource view" (columns per professional)
- Drag-and-drop reschedule is client-only (no server validation hook)
- Library bundles moment.js (400KB) when you use date-fns or day.js everywhere else

**Prevention strategy:**
- Before committing: build a prototype with real data (3+ professionals, 20+ bookings) in the candidate library
- Verify these specific capabilities:
  - Day/week view with columns per professional (resource view)
  - Click-to-create and drag-to-reschedule with async server validation (onEventChange callback that can reject)
  - Proper timezone support (display in `America/Sao_Paulo`, not browser local)
  - Reasonable bundle size and compatibility with your CSS framework (Tailwind/shadcn)
- FullCalendar is the most battle-tested option with resource view support, but verify the premium (paid) features you need vs. the free tier
- If team already uses shadcn/ui (from OrchestratorAI), note that shadcn has a basic calendar (date picker) that is NOT a scheduler — you still need a scheduling library

**Phase:** Phase 2 (Calendar Views) — but the prototype/spike should happen in Phase 1

---

### 5. Optimistic UI Updates Causing Ghost Bookings on Calendar

**What goes wrong:** Calendar shows an appointment immediately when receptionist creates it (optimistic update), but server rejects it (double-booking, slot expired, validation error). The appointment flickers — appears, disappears, or worse, appears to succeed but data is inconsistent. With TanStack Query, if `cancelQueries` is not called in `onMutate`, a background refetch can overwrite the optimistic state mid-mutation, causing the UI to "toggle" between states.

**Warning signs:**
- Booking appears on calendar but is not in the database
- Drag-reschedule shows appointment at new time, then it jumps back
- Two receptionists see different calendar states
- `refetchOnWindowFocus` triggers during a mutation, reverting optimistic state

**Prevention strategy:**
- For booking creation: do NOT use optimistic updates. Use loading state + server confirmation + invalidation. Bookings are high-stakes operations where showing false success is worse than a spinner.
- For drag-reschedule: show a "pending" visual state (opacity 50%, spinner) instead of optimistic success. Confirm with server, then update.
- Always call `queryClient.cancelQueries` in `onMutate` if you do use optimistic updates
- Use `queryClient.invalidateQueries` in `onSettled` (not just `onSuccess`) to ensure cache sync
- TanStack Query's `placeholderData` is better than optimistic updates for read operations

**Phase:** Phase 2 (Calendar Views) and Phase 3 (Booking Management)

---

## Moderate Pitfalls (Cause Delays or Technical Debt)

### 6. API Response Shape Mismatch Between Agent and Frontend Needs

**What goes wrong:** The existing API was designed for AI agent consumption. Responses return minimal data optimized for the agent flow (e.g., `GET /api/schedule/slots` returns flat time strings). The frontend needs richer data — professional names alongside IDs, service details with bookings, paginated lists with totals. Instead of adapting the API, developers either (a) make N+1 requests from the frontend or (b) start modifying existing endpoints and break the agent integration.

**Warning signs:**
- Frontend makes 5 API calls to render one calendar day (slots + professionals + services + bookings + clients)
- Existing endpoint response shape changes and agent integration breaks
- Frontend code has complex data-joining logic that should be server-side

**Prevention strategy:**
- Create NEW endpoints under `/api/admin/` or `/api/dashboard/` for frontend consumption — do not modify existing agent endpoints
- Design frontend-specific endpoints that return denormalized data (booking with client name, service name, professional name in one response)
- Add `include` or `expand` query parameters for Prisma eager loading
- Add pagination (`?page=1&limit=20&sort=startTime`) to list endpoints from day one
- Keep agent endpoints (`/api/bookings/*`, `/api/schedule/*`) untouched

**Phase:** Phase 1 — design frontend API layer before building components

---

### 7. JWT Token Refresh Not Implemented

**What goes wrong:** Current JWT has 8-hour expiry (see auth.js line 42). For an API called by agents, this is fine — agents re-authenticate programmatically. For a human user in a browser, the token expires mid-shift and suddenly every action fails with 401. The receptionist loses unsaved work and has to log in again. Worse, if the frontend does not handle 401 gracefully, it shows cryptic errors instead of redirecting to login.

**Warning signs:**
- Users report "the system stopped working" after a few hours
- 401 errors appear in the middle of a form submission
- No refresh token mechanism, no silent token renewal
- Frontend has no global 401 interceptor

**Prevention strategy:**
- Add a global Axios/fetch interceptor that catches 401 responses and redirects to login (preserving the current URL for redirect-back)
- Either implement refresh tokens (more complex but better UX) or extend token expiry to match shift duration (12h) with re-login at shift start
- For MVP: extend expiry + 401 interceptor with redirect. Add refresh tokens in a later phase if needed.
- Store token in memory (React state/context), not localStorage (XSS risk). Use httpOnly cookie if possible.

**Phase:** Phase 1 (Auth) — must be in place before real users start testing

---

### 8. Receptionist View That Is Just a Stripped Admin View

**What goes wrong:** Developers build the admin dashboard first, then create the receptionist view by hiding admin features with `role !== 'admin'` conditionals. Result: the receptionist sees an admin layout with gaps where buttons used to be. The workflow is wrong — a receptionist needs a TODAY-focused, fast-action interface (see today's appointments, quick-book, search client), not a feature-reduced admin panel.

**Warning signs:**
- Receptionist components import from admin components with conditional rendering
- Receptionist sees empty sidebars or navigation items they cannot use
- Receptionist interface requires 3+ clicks to create an appointment
- No "today's schedule" default view

**Prevention strategy:**
- Design the receptionist interface as a SEPARATE layout with its own navigation and component tree
- Receptionist default view: today's appointments grouped by professional, with inline quick-actions
- Key receptionist flows (all within 2 clicks): view today, create booking, find client, check-in client
- Share reusable components (BookingCard, ClientSearch) but not layouts or pages
- Get receptionist workflow feedback before building (what does a typical day look like?)

**Phase:** Phase 3 (Receptionist Interface) — designed independently, not derived from admin

---

### 9. Real-Time Sync Between Multiple Users Not Planned

**What goes wrong:** Two receptionists (or admin + receptionist) look at the same calendar. One books a slot, the other's view does not update. Second user tries to book the same slot and gets a server error. Or worse, with aggressive caching, the second user's view shows stale data for minutes.

**Warning signs:**
- TanStack Query `staleTime` set too high (>30s for calendar data)
- No visual indicator that data might be stale
- No mechanism to push updates to other connected clients
- Users report "I see the booking but my colleague doesn't"

**Prevention strategy:**
- For MVP: use short `staleTime` (30s for calendar views) + `refetchOnWindowFocus: true` + manual "refresh" button. This handles 80% of cases.
- Add `refetchInterval: 60000` (1 min) for the calendar day view as background polling
- Server-side: return `Last-Modified` header so clients know data freshness
- For v2.1+: add WebSocket/SSE for real-time push updates (not needed for MVP with 1-3 concurrent users)
- Always show "last updated X seconds ago" on the calendar view

**Phase:** Phase 2 (Calendar Views) — configure cache strategy from the start

---

### 10. Deploying Frontend and Backend on Same VPS Without Proper Routing

**What goes wrong:** The VPS (72.61.52.70) already runs OrchestratorAI. Adding service-schedule frontend means you need either (a) a separate port, (b) a subdomain, or (c) a path prefix. Common mistake: serving the React SPA from Express `express.static()` — this couples frontend deployment to backend restarts and makes it impossible to deploy frontend independently.

**Warning signs:**
- Frontend build artifacts served from the Express app's `public/` directory
- Backend restart kills the frontend
- Cannot deploy frontend without restarting the API (which disconnects active agent sessions)
- Nginx config becomes tangled with multiple apps on one IP

**Prevention strategy:**
- Use Nginx as reverse proxy: `schedule.yourdomain.com` for frontend, `api.schedule.yourdomain.com` for backend (or `/api` path prefix)
- Frontend: Vite build output served by Nginx directly (static files, no Node process needed)
- Backend: PM2 process, Nginx proxies `/api` to Express
- Separate PM2 processes: frontend deploy = Nginx config reload (zero downtime), backend deploy = PM2 restart
- Mirror the OrchestratorAI deployment pattern the team already uses

**Phase:** Phase 1 — set up deployment infrastructure before building features

---

### 11. Date/Time Display Inconsistency Between Backend and Frontend

**What goes wrong:** Backend stores times in UTC (as `Timestamptz`). Frontend displays them. Without a consistent conversion strategy, times appear wrong: a 14:00 BRT appointment shows as 17:00 on the calendar (UTC), or a booking created at midnight UTC appears on the wrong day in BRT. This is especially treacherous because it "works" in development if the developer's machine timezone matches the salon timezone.

**Warning signs:**
- Tests pass on developer machine but bookings appear on wrong day in production
- "Off-by-one day" errors for appointments near midnight
- Calendar shows times in UTC instead of salon timezone
- Developer hardcodes timezone offset instead of using proper timezone library

**Prevention strategy:**
- Establish a single rule: API returns UTC (ISO 8601 with Z suffix), frontend converts to salon timezone for display
- Use `date-fns-tz` or `luxon` for timezone conversion (NOT manual offset math)
- Store salon timezone in configuration (`America/Sao_Paulo`), load it at app startup
- All date formatting goes through a single utility function: `formatForDisplay(utcDate, salonTimezone)`
- Test with browser timezone set to UTC and to Asia/Tokyo — if calendar looks right, your conversion works

**Phase:** Phase 1 — establish date utility functions before any calendar work

---

## Minor Pitfalls (Fixable Friction)

### 12. Booking Status Color/Label Inconsistency

**What goes wrong:** Backend has 5 statuses (`PRE_RESERVED`, `CONFIRMED`, `CANCELLED`, `COMPLETED`, `NO_SHOW`). Frontend developers create ad-hoc color mappings in each component. One component shows PRE_RESERVED as yellow, another as blue. Labels vary: "Pre-reserved" vs "Pending" vs "Aguardando". Inconsistency confuses users.

**Prevention:** Create a single `BOOKING_STATUS_CONFIG` constant mapping each status to its label (in Portuguese), color, icon, and allowed transitions. Use it everywhere. Define it in Phase 1 as a shared constant.

---

### 13. Search Debounce Missing on Client Lookup

**What goes wrong:** Client search field (`buscar_cliente_por_telefone`) fires an API request on every keystroke. Typing "11999" sends 5 requests. Backend gets hammered, results flicker, and the correct result gets briefly shown then overwritten by a later (slower) request returning fewer results.

**Prevention:** Debounce search input (300ms). Use TanStack Query with `keepPreviousData: true` so results do not flicker. Cancel previous request when new one fires. Show loading indicator during debounce.

---

### 14. No Loading/Empty/Error States for Calendar Views

**What goes wrong:** Calendar view shows nothing while loading (white screen), shows nothing when there are no appointments (is it empty or broken?), and shows a generic error when the API fails. Users cannot tell if the system is working.

**Prevention:** Design three states for every view: loading (skeleton/shimmer), empty (helpful message: "Nenhum agendamento para hoje"), error (retry button with specific message). Use TanStack Query's `isLoading`, `isError`, `data.length === 0` to drive these states.

---

### 15. Form Validation Only on Submit

**What goes wrong:** Receptionist fills out a booking form (client, service, professional, time), submits, and only then sees "this professional does not offer this service" or "this time slot is taken." Wasted effort and frustration.

**Prevention:** Validate dependent fields in real-time:
- When professional is selected, filter services to only those the professional offers (use `ProfessionalService` relation)
- When service + professional + date are selected, fetch available slots immediately
- Disable the "create" button until all validations pass
- Use Zod for form validation (consistent with backend)

---

### 16. Not Reusing OrchestratorAI Component Patterns

**What goes wrong:** Team builds new component patterns (data tables, forms, modals) from scratch when OrchestratorAI already has established patterns with shadcn/ui + TanStack Query. Two codebases, two patterns, double the maintenance.

**Prevention:** Extract common patterns from OrchestratorAI as reference: how data tables work, how forms are structured, how modals are handled. Use the same shadcn/ui components, same TanStack Query patterns, same Tailwind configuration. If possible, create a shared component library later.

---

## Summary by Phase

| Phase | Critical Pitfalls | Moderate Pitfalls | Minor Pitfalls |
|-------|------------------|-------------------|----------------|
| Phase 1: Foundation/Auth | #1 No role field, #2 No backend role checks, #3 No CORS | #6 API shape mismatch, #7 Token refresh, #10 VPS routing, #11 Date/time | #12 Status config, #16 Reuse patterns |
| Phase 2: Calendar Views | #4 Calendar library lock-in, #5 Optimistic updates | #9 Real-time sync | #14 Loading/empty/error states |
| Phase 3: Booking/Receptionist | #5 Optimistic updates | #8 Receptionist as stripped admin | #13 Search debounce, #15 Form validation |

**Highest risk phase:** Phase 1 (Foundation) — 3 critical pitfalls plus 4 moderate. The existing API was built for agents, not browsers. The auth model, CORS, API shape, and deployment all need adaptation BEFORE any React component is written.

**Second highest risk:** Phase 2 (Calendar Views) — calendar library choice is a one-way door that is expensive to reverse. Prototype before committing.

---

## Existing Pitfalls Still Relevant

The v1.0 pitfalls (race conditions, double-booking, TTL expiry, timezone storage) remain relevant. The frontend does NOT fix these — it merely exposes them to human users who are less tolerant of glitches than AI agents. Specifically:

- **Pitfall v1.0 #1 (Race conditions):** Now receptionists can create concurrent bookings, not just AI agents. Same server-side protections apply.
- **Pitfall v1.0 #4 (Timezone):** Now the frontend must correctly display times that the backend already stores correctly. New failure mode: display-layer conversion errors.
- **Pitfall v1.0 #11 (No-slots reason):** The frontend calendar can show this information visually (greyed-out days, "off" labels), making the structured response even more important.

---

## Confidence Assessment

| Area | Confidence | Basis |
|------|------------|-------|
| Auth/RBAC pitfalls (#1, #2) | HIGH | Verified by reading actual source code — `AdminUser` has no role, JWT hardcodes 'admin' |
| CORS pitfall (#3) | HIGH | Verified — no CORS middleware in existing middleware directory |
| Calendar library risks (#4) | MEDIUM | Based on ecosystem research; specific library choice not yet evaluated |
| Optimistic update patterns (#5) | HIGH | Well-documented TanStack Query pattern, verified with official docs |
| API shape mismatch (#6) | HIGH | Verified by reading existing routes — agent-optimized, no pagination, no eager loading |
| Deployment (#10) | HIGH | VPS deployment pattern verified from OrchestratorAI project memory |
| Date/time display (#11) | HIGH | Schema uses Timestamptz correctly; frontend conversion is the new risk surface |

---

## Sources

- Project source code: `src/middleware/auth.js`, `src/routes/admin/auth.js`, `prisma/schema.prisma`
- [TanStack Query Optimistic Updates Discussion #7932](https://github.com/TanStack/query/discussions/7932)
- [Concurrent Optimistic Updates in React Query (TkDodo)](https://tkdodo.eu/blog/concurrent-optimistic-updates-in-react-query)
- [Common Mistakes in React Admin Dashboards (DEV Community)](https://dev.to/vaibhavg/common-mistakes-in-react-admin-dashboards-and-how-to-avoid-them-1i70)
- [RBAC in Node.js and React (Medium)](https://medium.com/@ignatovich.dm/implementing-role-based-access-control-rbac-in-node-js-and-react-c3d89af6f945)
- [React Calendar Components Comparison (DHTMLX)](https://dhtmlx.com/blog/best-react-scheduler-components-dhtmlx-bryntum-syncfusion-daypilot-fullcalendar/)
- [Solving Frontend-Backend Integration Issues in Deployed React App](https://blog.slray.com/2024/10/21/Solving-Frontend-and-Backend-Integration-Issues-in-a-Deployed-React-Application/)

---
*Research completed: 2026-03-13*
