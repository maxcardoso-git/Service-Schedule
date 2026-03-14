# Frontend Stack Research -- Service-Schedule v2.0

**Project:** Service-schedule (beauty salon scheduling platform)
**Scope:** Admin dashboard + Receptionist interface (SPA frontend for existing Express API)
**Researched:** 2026-03-13
**Overall confidence:** HIGH

---

## Recommended Stack

### Core Framework

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **React** | ^19.2.4 | UI framework | React 19 is stable (released Dec 2024, now at 19.2.4). New project -- no migration cost. Ref-as-prop simplifies component authoring. Team knows React from OrchestratorAI. |
| **React DOM** | ^19.2.4 | DOM rendering | Paired with React 19 |
| **Vite** | ^8.0.0 | Build tool / dev server | Same toolchain as OrchestratorAI. Vite 8 just released (Mar 12, 2026) with Rolldown bundler. Fast HMR, static build output for VPS deployment. |
| **@vitejs/plugin-react** | ^6.0.1 | React Fast Refresh for Vite | Standard React+Vite integration |

**Why React 19 instead of 18 (like OrchestratorAI):** This is a greenfield project with zero existing components. React 19 is stable for 15+ months. Starting on 18 means an eventual migration. The shadcn/ui ecosystem already supports React 19 + Tailwind v4. No reason to start behind.

### Routing

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **react-router-dom** | ^7.13.1 | Client-side routing | Same library as OrchestratorAI. v7 is stable. Supports nested layouts needed for admin shell (sidebar + content area). |

**Route structure:**

```
/login
/admin/calendar          -- Weekly/daily calendar view
/admin/bookings          -- Booking list/management
/admin/services          -- Services CRUD
/admin/professionals     -- Professionals CRUD
/admin/clients           -- Clients CRUD
/admin/settings          -- Business hours, etc.
/reception/today         -- Day view for receptionist
/reception/book          -- Quick booking flow
/reception/search        -- Client search
```

Role-based route guards: admin sees `/admin/*`, receptionist sees `/reception/*`. Both share `/login`.

### UI Components

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **shadcn/ui** | latest (CLI-installed) | Component library | NOT a dependency -- copies component source into project. Same system as OrchestratorAI. Radix primitives underneath. Full React 19 + Tailwind v4 support confirmed. |
| **Tailwind CSS** | ^4.2.1 | Utility-first CSS | v4 is stable (released Jan 2025). 5x faster builds. CSS-first config (no tailwind.config.js). OrchestratorAI uses v3 but new project should use v4 -- no migration burden. |
| **Radix UI primitives** | latest | Accessible primitives | Installed via shadcn/ui CLI. Dialog, Select, Popover, DropdownMenu, Tabs, Toast. |
| **lucide-react** | ^0.577.0 | Icons | Same as OrchestratorAI. Consistent icon language. Tree-shakeable. |
| **class-variance-authority** | ^0.7.1 | Variant styling | Used by shadcn/ui components |
| **clsx** | ^2.1.1 | Class name merging | Used with tailwind-merge |
| **tailwind-merge** | ^3.5.0 | Tailwind class conflict resolution | Prevents duplicate utility classes |
| **sonner** | ^2.0.7 | Toast notifications | Same as OrchestratorAI. Better DX than Radix toast. |

**Why shadcn/ui and NOT a full component suite (Ant Design, MUI, Chakra):**
1. Team already uses it in OrchestratorAI -- zero learning curve
2. Source ownership -- components live in your project, fully customizable
3. Tailwind-native -- no CSS-in-JS runtime overhead
4. Only install what you need -- no 500KB bundle for 20 components

### Calendar / Scheduling View

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **FullCalendar** | ^6.1.20 | Weekly/daily calendar grid | Industry standard for scheduling UIs. 19K+ GitHub stars, 1M+ weekly npm downloads. MIT license for core features. Day/week/list views included free. Drag-and-drop via interaction plugin. |
| **@fullcalendar/react** | ^6.1.20 | React wrapper | Official React component |
| **@fullcalendar/core** | ^6.1.20 | Core engine | Required peer dependency |
| **@fullcalendar/daygrid** | ^6.1.20 | Month/day grid view | For monthly overview |
| **@fullcalendar/timegrid** | ^6.1.20 | Time slot grid | For daily/weekly schedule -- the PRIMARY view for a salon |
| **@fullcalendar/interaction** | ^6.1.20 | Drag & drop, click | Enables click-to-book, drag-to-reschedule |
| **@fullcalendar/list** | ^6.1.20 | List/agenda view | Receptionist agenda view |

**Why FullCalendar over alternatives:**

| Criterion | FullCalendar | react-big-calendar | Schedule-X |
|-----------|-------------|-------------------|------------|
| Time grid (hourly slots) | Excellent | Good | Good |
| Drag & drop | Built-in plugin | Via addon | Built-in |
| Resource columns (professionals) | Premium plugin | No | No |
| Bundle size | ~45KB | ~35KB | ~25KB |
| Maintenance | Active, v6 stable | Slower releases | Newer, less proven |
| React 19 support | Yes | Yes | Yes |
| License | MIT (core) | MIT | MIT |

**Decision:** FullCalendar. The timegrid view is exactly what a salon calendar needs. The free tier covers day/week/list views, drag-and-drop, and event clicking. Resource view (showing columns per professional) requires the premium license ($499/yr) but is NOT needed for MVP -- filter by professional instead.

**Alternatives considered and rejected:**
- **react-big-calendar:** Fewer features, less active maintenance, no official plugin architecture
- **Planby:** Timeline-oriented (horizontal), not calendar-oriented (vertical time slots). Wrong paradigm for salon booking.
- **DHTMLX Scheduler:** Commercial license required for production
- **Build custom:** Massive effort for drag-and-drop time grid. FullCalendar solves this in hours, not weeks.

### Data Fetching & Server State

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **@tanstack/react-query** | ^5.90.21 | Server state management | Same as OrchestratorAI. Handles caching, refetching, loading/error states. Critical for calendar data that needs background refresh (new bookings from agents). |

**Key query patterns for this project:**
- `useQuery(['bookings', date, professionalId])` -- calendar events
- `useQuery(['services'])` -- service list (rarely changes, long staleTime)
- `useMutation` for booking create/update/cancel with `queryClient.invalidateQueries`
- `refetchInterval: 30000` on calendar queries -- auto-refresh for new agent bookings

**Why NOT plain fetch:**
- Calendar needs automatic background refresh (bookings created by AI agents appear without page reload)
- Optimistic updates for drag-and-drop rescheduling
- Request deduplication when multiple components need same data

### Client State

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **zustand** | ^5.0.11 | Client-side state | Lightweight (1.2KB), no Provider boilerplate, hook-based. For UI state: selected professional filter, sidebar collapsed, current view mode. |

**What goes in Zustand (client state):**
- `selectedProfessionalId` -- calendar filter
- `calendarView` -- 'day' | 'week'
- `sidebarCollapsed` -- layout preference
- User session (role, name) after JWT decode

**What stays in TanStack Query (server state):**
- Bookings, services, professionals, clients
- Any data from the API

**Why NOT Redux/Context:**
- Redux: overkill for this scope, more boilerplate
- Context: causes unnecessary re-renders, no built-in devtools
- Zustand + TanStack Query is the dominant pattern in 2026 React apps

### Forms & Validation

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **react-hook-form** | ^7.71.2 | Form state management | Same as OrchestratorAI. Uncontrolled forms = minimal re-renders. Built-in validation. |
| **@hookform/resolvers** | ^5.2.2 | Schema validation bridge | Connects react-hook-form to Zod schemas |
| **zod** | ^3.25.76 | Schema validation | Already in backend. Share validation schemas between front and back eventually. Same version as backend. |

**Forms in this project:**
- Booking form (service, professional, date/time, client)
- Service CRUD form
- Professional CRUD form (name, services, working hours)
- Client form (name, phone, notes)
- Login form
- Business settings form

### Date Handling

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **date-fns** | ^4.1.0 | Date manipulation | Already in backend (v3). Frontend uses v4 (latest). Tree-shakeable, locale support for pt-BR. Used by FullCalendar internally. |

**Why date-fns v4:** The backend has v3, but v4 is latest and this is a separate package.json. No breaking changes that affect usage patterns. Functions like `format`, `addDays`, `startOfWeek`, `isSameDay` are identical.

### HTTP Client

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **fetch (native)** | built-in | HTTP requests | No library needed. TanStack Query wraps the fetch calls. Native fetch is sufficient for REST API calls. Avoid adding axios for a simple CRUD API. |

**API client pattern:**

```javascript
// src/lib/api.ts
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export async function apiFetch(path, options = {}) {
  const token = localStorage.getItem('token');
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new ApiError(res.status, error.message || 'Request failed');
  }
  return res.json();
}
```

### Authentication (Frontend)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **JWT decode** | manual | Token parsing | `JSON.parse(atob(token.split('.')[1]))` -- no library needed for simple JWT payload reading. Backend already issues JWTs. |

**Auth flow:**
1. Login form POSTs to `/api/auth/login`
2. Backend returns JWT with `{ userId, role, name }`
3. Frontend stores token in `localStorage`
4. All API calls include `Authorization: Bearer <token>`
5. Route guards check role from decoded JWT
6. Token expiry check on app load + API 401 interceptor

**Why NOT a JWT library:** The frontend never verifies JWT signatures (that is the backend's job). It only reads the payload for role/name. A 1-line `atob` call replaces a library dependency.

### Build & Dev Tools

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **Vite** | ^8.0.0 | Build tool | Static output (`dist/`) for VPS deployment |
| **ESLint** | ^9.19.0 | Linting | Same config style as OrchestratorAI |
| **PostCSS** | ^8.5.8 | CSS processing | Required by Tailwind v4 |
| **autoprefixer** | ^10.4.27 | Browser prefixes | Standard PostCSS plugin |

---

## What NOT to Use

| Technology | Why Avoid |
|------------|-----------|
| **Next.js / Remix** | Over-engineered for a dashboard SPA. No SSR/SSG needed. VPS deployment is simpler with static files. The backend already exists as Express. |
| **Ant Design / MUI** | Different design system than OrchestratorAI. Heavyweight bundles. Team already knows shadcn/ui. |
| **Redux / Redux Toolkit** | Overkill for this app's client state. Zustand + TanStack Query covers everything with less code. |
| **axios** | Unnecessary dependency. Native fetch + TanStack Query is sufficient for REST calls. |
| **moment.js** | Deprecated, 67KB bundle. date-fns is already in the project. |
| **Tailwind CSS v3** | v4 is stable for 14+ months. No reason to start a new project on v3. |
| **React 18** | v19 is stable for 15+ months. Greenfield project should use current stable. |
| **@fullcalendar/resource plugins** | Premium ($499/yr). Not needed for MVP -- use professional filter dropdown instead of resource columns. Revisit if salon has 10+ professionals. |
| **react-big-calendar** | Less maintained, fewer features than FullCalendar, no plugin ecosystem. |
| **CSS Modules / styled-components** | Tailwind is the standard. Mixing paradigms creates confusion. |
| **TypeScript** | OrchestratorAI uses JavaScript. Maintain consistency. Zod provides runtime validation where types matter most. If team wants TS later, Vite supports it with zero config -- easy to adopt incrementally. |

---

## Installation

```bash
# Initialize frontend project
npm create vite@latest frontend -- --template react

cd frontend

# Core UI
npm install react@^19.2.4 react-dom@^19.2.4
npm install react-router-dom@^7.13.1
npm install @tanstack/react-query@^5.90.21
npm install zustand@^5.0.11

# Forms
npm install react-hook-form@^7.71.2 @hookform/resolvers@^5.2.2 zod@^3.25.76

# Calendar
npm install @fullcalendar/react@^6.1.20 @fullcalendar/core@^6.1.20 \
  @fullcalendar/daygrid@^6.1.20 @fullcalendar/timegrid@^6.1.20 \
  @fullcalendar/interaction@^6.1.20 @fullcalendar/list@^6.1.20

# UI utilities
npm install lucide-react@^0.577.0 sonner@^2.0.7 date-fns@^4.1.0
npm install class-variance-authority@^0.7.1 clsx@^2.1.1 tailwind-merge@^3.5.0

# Dev dependencies
npm install -D tailwindcss@^4.2.1 postcss@^8.5.8 autoprefixer@^10.4.27
npm install -D @vitejs/plugin-react@^6.0.1
npm install -D eslint@^9.19.0

# shadcn/ui (adds components one at a time)
npx shadcn@latest init
npx shadcn@latest add button card dialog input label select table tabs toast
```

---

## Integration with Existing Backend

### API Endpoints the Frontend Consumes

The backend already exposes these REST endpoints (from v1.0):

| Endpoint | Frontend Usage |
|----------|---------------|
| `POST /api/auth/login` | Login form |
| `GET /api/bookings` | Calendar events, booking list |
| `POST /api/bookings` | Create booking (admin + receptionist) |
| `PATCH /api/bookings/:id` | Reschedule (drag-and-drop), update status |
| `DELETE /api/bookings/:id` | Cancel booking |
| `GET /api/services` | Service picker in booking form |
| `GET /api/professionals` | Professional filter, booking form |
| `GET /api/professionals/:id/availability` | Available time slots |
| `GET /api/clients` | Client search, booking form |

### CORS Configuration

Backend already has `cors` package. Update to allow frontend origin:

```javascript
// backend: already has cors middleware
app.use(cors({
  origin: ['http://localhost:5173', 'https://yourdomain.com'],
  credentials: true
}));
```

### Deployment on VPS

Two options:

**Option A (recommended): Static files via Express**
```bash
# Build frontend
cd frontend && npm run build
# Serve dist/ from Express or nginx
```
Express serves `dist/` as static files. Single process. No additional PM2 entry.

**Option B: Vite dev server via PM2**
Like OrchestratorAI's current setup. More resource usage but enables HMR on production (not recommended for production).

**Recommendation:** Option A. Build to static files, serve via nginx or Express static middleware. Simpler, faster, fewer resources on VPS.

---

## Confidence Assessment

| Area | Confidence | Basis |
|------|------------|-------|
| React 19 + Vite 8 | HIGH | Verified versions via npm, stable for 15+ months |
| shadcn/ui + Tailwind v4 | HIGH | Official compatibility confirmed, OrchestratorAI team familiarity |
| FullCalendar v6 | HIGH | Verified version via npm, industry standard for scheduling UIs |
| TanStack Query + Zustand | HIGH | Verified versions, dominant 2026 pattern for React state management |
| react-hook-form + Zod | HIGH | Same stack as OrchestratorAI, versions verified |
| Deployment strategy | MEDIUM | Static files is standard but VPS nginx config untested |

---

## Sources

- [React v19 stable release](https://react.dev/blog/2024/12/05/react-19)
- [React 19.2 release](https://react.dev/blog/2025/10/01/react-19-2)
- [Vite releases](https://vite.dev/releases)
- [Tailwind CSS v4.0 release](https://tailwindcss.com/blog/tailwindcss-v4)
- [shadcn/ui React 19 + Tailwind v4 support](https://ui.shadcn.com/docs/react-19)
- [FullCalendar React docs](https://fullcalendar.io/docs/react)
- [FullCalendar releases](https://github.com/fullcalendar/fullcalendar/releases)
- [TanStack Query overview](https://tanstack.com/query/latest)
- [React Router changelog](https://reactrouter.com/changelog)
- [Best React Scheduler Components comparison](https://dhtmlx.com/blog/best-react-scheduler-components-dhtmlx-bryntum-syncfusion-daypilot-fullcalendar/)
- npm registry (direct version verification via `npm view`)

---
*Research completed: 2026-03-13*
