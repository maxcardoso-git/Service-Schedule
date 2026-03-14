# Architecture Research — Frontend Integration

**Project:** Service-schedule (beauty salon scheduling)
**Dimension:** React frontend integration with existing Express REST API
**Researched:** 2026-03-13
**Overall confidence:** HIGH

---

## Serving Strategy: Express Serves Built React Assets

**Recommendation: Single server, Express serves Vite production build as static files.**

This is the correct choice for this project. The alternatives and why they lose:

| Strategy | Verdict | Reason |
|----------|---------|--------|
| **Express serves static build** | **USE THIS** | Single process, single port, simplest VPS deployment, PM2 manages one process |
| Separate Vite dev server in production | NO | OrchestratorAI already does this (PM2 id 0) and it is a hack — Vite dev server is not a production server |
| Nginx reverse proxy to separate frontend | NO | Adds infrastructure complexity for zero benefit on a single-VPS deployment |
| Separate subdomain for frontend | NO | Over-engineered for a single-salon tool |

### How It Works

**Development:** Vite dev server on port 5173, proxies `/api/*` to Express on port 3150.

```javascript
// vite.config.js
export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3150',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: '../dist',  // builds into project root /dist
  },
});
```

**Production:** Express serves the built static files. One PM2 process.

```javascript
// In src/app.js — add AFTER all API routes, BEFORE error handler
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Serve React build in production
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '..', '..', 'frontend', 'dist');
  app.use(express.static(distPath));

  // SPA fallback — all non-API routes serve index.html
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(distPath, 'index.html'));
  });
}
```

**Why this works well:**
- API routes are mounted first (`/api/*`), so they take priority
- The SPA catch-all only handles non-API routes
- Static assets (JS, CSS, images) served by `express.static` with proper caching
- Single PM2 process to manage on VPS
- No CORS needed in production (same origin)
- CORS remains configured for development (Vite dev server on different port)

### Deployment Flow

```
Local: npm run build (in frontend/)
       scp frontend/dist/ → VPS:/root/Service-schedule/frontend/dist/
       pm2 restart service-schedule

  OR

VPS:   cd /root/Service-schedule/frontend && npm run build
       pm2 restart service-schedule
```

---

## Project Structure: Monorepo with frontend/ Directory

The frontend lives as a sibling directory to the existing `src/` backend code. NOT inside `src/`. NOT a separate repository.

```
Service-schedule/
├── prisma/                    # Existing — unchanged
│   ├── schema.prisma
│   └── seed.js
├── src/                       # Existing backend — minimal changes
│   ├── app.js                 # ADD: static file serving for production
│   ├── server.js              # Unchanged
│   ├── middleware/             # Unchanged
│   ├── routes/                # Existing + new admin routes
│   │   ├── admin/
│   │   │   ├── auth.js        # Existing — login endpoint
│   │   │   ├── services.js    # Existing — service CRUD
│   │   │   ├── professionals.js # Existing — professional CRUD
│   │   │   ├── bookings.js    # NEW — admin booking management
│   │   │   ├── clients.js     # NEW — admin client management
│   │   │   ├── dashboard.js   # NEW — analytics/summary endpoints
│   │   │   └── users.js       # NEW — admin user management
│   │   ├── bookings.js        # Existing — agent-facing
│   │   ├── clients.js         # Existing — agent-facing
│   │   └── ...
│   ├── services/              # Existing + new service methods
│   └── lib/                   # Existing
├── frontend/                  # NEW — entire React application
│   ├── package.json           # Separate package.json (own deps)
│   ├── vite.config.js
│   ├── tsconfig.json          # TypeScript for frontend only
│   ├── index.html
│   ├── src/
│   │   ├── main.tsx           # Entry point
│   │   ├── App.tsx            # Root component with router
│   │   ├── api/               # API client layer
│   │   │   ├── client.ts      # Fetch wrapper with auth
│   │   │   ├── bookings.ts    # Booking API calls
│   │   │   ├── services.ts    # Service API calls
│   │   │   ├── professionals.ts
│   │   │   ├── clients.ts
│   │   │   └── dashboard.ts
│   │   ├── hooks/             # React Query hooks
│   │   │   ├── useBookings.ts
│   │   │   ├── useServices.ts
│   │   │   └── ...
│   │   ├── components/        # Shared components
│   │   │   ├── ui/            # Base UI components (shadcn)
│   │   │   ├── layout/        # Sidebar, Header, etc.
│   │   │   ├── calendar/      # Calendar-specific components
│   │   │   └── forms/         # Shared form components
│   │   ├── pages/             # Route-level page components
│   │   │   ├── Login.tsx
│   │   │   ├── admin/         # Admin-only pages
│   │   │   │   ├── Dashboard.tsx
│   │   │   │   ├── Services.tsx
│   │   │   │   ├── Professionals.tsx
│   │   │   │   ├── Clients.tsx
│   │   │   │   ├── Calendar.tsx
│   │   │   │   └── Settings.tsx
│   │   │   └── receptionist/  # Receptionist pages
│   │   │       ├── DailyView.tsx
│   │   │       ├── NewBooking.tsx
│   │   │       └── ClientLookup.tsx
│   │   ├── stores/            # Zustand stores
│   │   │   └── authStore.ts
│   │   ├── lib/               # Utilities
│   │   │   ├── auth.ts        # Token management
│   │   │   └── dates.ts       # Date formatting helpers
│   │   └── types/             # TypeScript types
│   │       └── api.ts         # API response types
│   └── dist/                  # Build output (gitignored)
├── package.json               # Existing backend package.json
└── .env                       # Shared env (backend reads it)
```

**Why separate `frontend/` with its own `package.json`:**
- Backend is plain JavaScript (ESM), frontend is TypeScript + JSX — different toolchains
- Separate dependency trees prevent bloat (backend does not need React, frontend does not need Prisma)
- Build commands are independent: `npm run build` in `frontend/` does not touch backend
- Matches the existing OrchestratorAI pattern (separate frontend directory)

---

## Authentication Flow: JWT with Role-Based Access

The backend already has JWT auth for admin users. The frontend integrates with it directly.

### Login Flow

```
1. User enters email + password on /login page
2. Frontend POST /api/admin/auth/login
3. Backend returns { token, admin: { id, name, email } }
4. Frontend stores token in memory (Zustand store) + localStorage for persistence
5. All subsequent API calls include Authorization: Bearer <token>
6. Token expires after 8h (already configured in backend)
```

### Token Management

```typescript
// frontend/src/api/client.ts
const API_BASE = '/api';

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = useAuthStore.getState().token;

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (res.status === 401) {
    // Token expired or invalid — redirect to login
    useAuthStore.getState().logout();
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    const error = await res.json();
    throw new ApiError(error.code, error.message, res.status);
  }

  return res.json();
}
```

### Role-Based Views: Single App, Role-Filtered Routes

**Recommendation: One React app, routes filtered by role. NOT two separate apps.**

Two separate apps would mean two build processes, two deployment targets, duplicate shared components. Unnecessary for two roles.

The backend `AdminUser` model needs a `role` field added:

```prisma
model AdminUser {
  id        String   @id @default(uuid()) @db.Uuid
  name      String   @db.VarChar(200)
  email     String   @unique @db.VarChar(255)
  password  String   @db.VarChar(255)
  role      String   @default("receptionist") @db.VarChar(50)  // NEW
  active    Boolean  @default(true)
  createdAt DateTime @default(now()) @db.Timestamptz
  updatedAt DateTime @updatedAt @db.Timestamptz
}
```

The JWT payload already includes `role: 'admin'` (hardcoded in auth.js). Change this to read from the user record:

```javascript
const token = jwt.sign(
  { id: user.id, email: user.email, role: user.role },  // dynamic role
  process.env.JWT_SECRET,
  { expiresIn: '8h' }
);
```

**Frontend role filtering pattern:**

```tsx
// ProtectedRoute component
function ProtectedRoute({ roles, children }) {
  const { user } = useAuthStore();

  if (!user) return <Navigate to="/login" />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" />;

  return children;
}

// Route definitions
<Route path="/admin/services" element={
  <ProtectedRoute roles={['admin']}>
    <ServicesPage />
  </ProtectedRoute>
} />

<Route path="/daily" element={
  <ProtectedRoute roles={['admin', 'receptionist']}>
    <DailyView />
  </ProtectedRoute>
} />
```

**Navigation adapts to role:**
- Admin sees: Dashboard, Calendar, Services, Professionals, Clients, Settings
- Receptionist sees: Daily View, New Booking, Client Lookup

Both share the same layout shell (sidebar + header). The sidebar menu items are filtered by role.

---

## API Client Pattern: TanStack Query + Thin Fetch Wrapper

**Recommendation: TanStack Query (React Query) for server state. NOT Redux, NOT SWR.**

TanStack Query is the standard for server-state management in React SPAs in 2026. It handles caching, refetching, optimistic updates, and loading/error states.

### Architecture Layers

```
Page Component (uses hook)
    ↓
Custom Hook (useBookings, useServices)
    ↓
TanStack Query (useQuery / useMutation)
    ↓
API Client Function (apiFetch wrapper)
    ↓
fetch() → Express API
```

### Example: Booking List

```typescript
// frontend/src/api/bookings.ts
export async function getBookings(params: BookingFilters) {
  return apiFetch<PaginatedResponse<Booking>>('/admin/bookings', {
    method: 'GET',
    // query params appended
  });
}

export async function cancelBooking(id: string) {
  return apiFetch<Booking>(`/bookings/${id}/cancel`, { method: 'POST' });
}

// frontend/src/hooks/useBookings.ts
export function useBookings(filters: BookingFilters) {
  return useQuery({
    queryKey: ['bookings', filters],
    queryFn: () => getBookings(filters),
  });
}

export function useCancelBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: cancelBooking,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
    },
  });
}

// frontend/src/pages/admin/Bookings.tsx
function BookingsPage() {
  const [filters, setFilters] = useState({ date: today() });
  const { data, isLoading, error } = useBookings(filters);

  if (isLoading) return <Skeleton />;
  if (error) return <ErrorAlert error={error} />;

  return <BookingTable bookings={data.items} />;
}
```

### Why Not Other Approaches

| Approach | Why Not |
|----------|---------|
| Redux + RTK Query | Heavier, more boilerplate, Redux is for client state not server state |
| SWR | Less feature-rich than TanStack Query, weaker mutation support |
| Plain fetch + useState | Manual loading/error/caching management, reinventing the wheel |
| Axios | Unnecessary dependency — native `fetch` is sufficient, apiFetch wrapper handles auth |

---

## Component Architecture

### Admin Dashboard Views

**Dashboard (admin only):**
- Today's booking count, revenue summary
- Upcoming bookings list (next 5)
- Quick actions: view calendar, add service
- Requires: `GET /api/admin/dashboard/summary` (NEW endpoint)

**Calendar (admin only):**
- Weekly/daily calendar view showing all professionals' bookings
- Color-coded by professional or by status
- Click booking to view/edit details
- Requires: `GET /api/admin/bookings?startDate=X&endDate=Y` (NEW endpoint, returns all bookings in range)
- Calendar component: use `@schedule-x/react` or `react-big-calendar` (dedicated research needed during implementation)

**Services Management (admin only):**
- Table with all services (name, duration, price, active/inactive)
- Create/edit service form (modal or drawer)
- Toggle active/inactive
- Existing endpoints: `GET/POST/PUT /api/admin/services` (already built)

**Professionals Management (admin only):**
- Table with all professionals
- Working hours configuration per professional
- Service assignment management
- Existing endpoints: `GET/POST/PUT /api/admin/professionals` (already built)

**Client Management (admin only):**
- Searchable client list
- Client booking history
- Existing: `GET /api/clients` (agent-facing, may need admin variant with pagination)

### Receptionist Views

**Daily View (receptionist + admin):**
- Shows today's bookings in timeline format
- Grouped by professional
- Status badges (confirmed, pre-reserved, completed, no-show)
- Quick actions: mark as completed, mark as no-show, cancel
- Requires: `GET /api/admin/bookings?date=today` (filtered by single day)

**New Booking (receptionist + admin):**
- Step-by-step booking creation:
  1. Select or create client (phone lookup)
  2. Select service
  3. Select professional (filtered by service)
  4. Select date + available slot
  5. Confirm booking
- Uses existing endpoints in sequence: client lookup, service list, slot query, booking create
- This is the same flow the AI agent follows, but with a UI

**Client Lookup (receptionist + admin):**
- Search by phone or name
- View upcoming bookings for client
- Quick rebook action

---

## New Backend Endpoints Required

The existing API was designed for AI agent consumption. The frontend needs additional admin-focused endpoints.

### New Routes Needed

| Endpoint | Purpose | Notes |
|----------|---------|-------|
| `GET /api/admin/bookings` | List bookings with filters (date range, status, professional, client) | Paginated, sortable |
| `GET /api/admin/bookings/:id` | Single booking detail with related data | Includes client, professional, services, payment |
| `PATCH /api/admin/bookings/:id/status` | Change booking status (complete, no-show) | Admin-only status transitions |
| `GET /api/admin/clients` | Paginated client list with search | Different from agent `/api/clients` (needs pagination) |
| `GET /api/admin/clients/:id/bookings` | Client booking history | For client detail view |
| `GET /api/admin/dashboard/summary` | Dashboard stats (today's bookings, revenue, etc.) | Aggregation query |
| `POST /api/admin/users` | Create admin/receptionist user | Admin-only |
| `GET /api/admin/users` | List admin users | Admin-only |
| `PATCH /api/admin/users/:id` | Update admin user (role, active) | Admin-only |

### Existing Endpoints Reused by Frontend

These already exist and the frontend calls them directly:

| Endpoint | Frontend Use |
|----------|-------------|
| `POST /api/admin/auth/login` | Login form |
| `GET /api/services` | Service list display |
| `GET/POST/PUT /api/admin/services` | Service CRUD (admin) |
| `GET/POST/PUT /api/admin/professionals` | Professional CRUD (admin) |
| `GET /api/bookings/available-slots` | Slot picker in new booking flow |
| `POST /api/bookings/pre-reserve` | Create booking from receptionist |
| `POST /api/bookings/:id/confirm` | Confirm booking |
| `POST /api/bookings/:id/cancel` | Cancel booking |
| `GET /api/clients/by-phone/:phone` | Client lookup |
| `POST /api/clients` | Client creation |

---

## Data Flow Changes

### Current (API only)

```
AI Agent → API Key Auth → Express Routes → Services → Prisma → PostgreSQL
```

### With Frontend

```
React SPA → JWT Auth → Express Admin Routes → Services → Prisma → PostgreSQL
AI Agent  → API Key Auth → Express Agent Routes → Services → Prisma → PostgreSQL
```

**Key principle: Both frontend and AI agents call the same service layer.** The routes are different (admin routes have pagination, filtering, richer responses), but they delegate to the same `bookingService.js`, `clientService.js`, etc. This avoids business logic duplication.

Where admin routes need different behavior (e.g., paginated list vs. single lookup), add new methods to existing services — do NOT create separate admin service files.

```
// bookingService.js — existing
export function createPreReservation(data) { ... }
export function confirmBooking(id) { ... }

// bookingService.js — add for admin frontend
export function listBookings(filters, pagination) { ... }
export function getBookingDetail(id) { ... }
export function updateBookingStatus(id, status) { ... }
```

---

## Integration Points with Existing Components

### Modified (Minimal Changes)

| Component | Change | Risk |
|-----------|--------|------|
| `src/app.js` | Add static file serving for production, mount new admin routes | LOW — additive only |
| `src/middleware/auth.js` | No changes needed — `adminAuth` middleware already exists | NONE |
| `prisma/schema.prisma` | Add `role` field to `AdminUser` | LOW — single field addition |
| `src/routes/admin/auth.js` | Return `role` in JWT payload from user record | LOW — one line change |
| `.env` | Add `NODE_ENV=production` for VPS | LOW |

### Unchanged (Zero Modifications)

| Component | Why Unchanged |
|-----------|---------------|
| All agent-facing routes (`/api/bookings`, `/api/clients`, etc.) | Frontend uses admin routes, not agent routes |
| `src/middleware/validate.js` | Reused as-is for new admin routes |
| `src/middleware/errorHandler.js` | Already returns structured JSON errors |
| `src/services/*` | Extended with new methods, existing methods untouched |
| `src/lib/prisma.js` | Shared Prisma client, no changes |
| `src/jobs/expireReservations.js` | Background job, no frontend interaction |
| `src/swagger.js` | Swagger docs remain available at `/api-docs` |

### New Components

| Component | Purpose |
|-----------|---------|
| `frontend/` directory | Entire React application |
| `src/routes/admin/bookings.js` | Admin booking management endpoints |
| `src/routes/admin/clients.js` | Admin client management endpoints |
| `src/routes/admin/dashboard.js` | Dashboard summary endpoint |
| `src/routes/admin/users.js` | Admin user management endpoints |

---

## Suggested Build Order

Based on dependency analysis and integration risk:

### Phase N+1: Frontend Foundation + Auth

Build the skeleton and prove the integration pattern works.

**Backend work:**
- Add `role` to `AdminUser` schema + migration
- Update login endpoint to include role in JWT
- Add static file serving to `app.js` (production mode)
- Create admin user management endpoints (`POST/GET/PATCH /api/admin/users`)

**Frontend work:**
- Initialize Vite + React + TypeScript project in `frontend/`
- Configure Vite proxy for development
- Build API client with auth token management (apiFetch wrapper)
- Build login page
- Build layout shell (sidebar + header)
- Implement role-based route protection
- Build admin user management page (proves full CRUD cycle)

**Why first:** Until login works and the API client pattern is established, nothing else can proceed. Admin user management is the simplest CRUD to validate the full stack.

### Phase N+2: Service & Professional Management UI

Wire up existing admin endpoints to React components.

**Backend work:**
- Possibly add pagination to existing admin service/professional endpoints (if not already present)

**Frontend work:**
- Services list + create/edit form
- Professionals list + create/edit form
- Working hours configuration UI
- Service-to-professional assignment UI

**Why second:** These admin CRUD pages are the simplest views (table + form pattern). They use existing endpoints. They build confidence and establish component patterns before the complex scheduling views.

### Phase N+3: Booking Management + Daily View

The core scheduling UI.

**Backend work:**
- `GET /api/admin/bookings` (paginated, filterable by date/status/professional/client)
- `GET /api/admin/bookings/:id` (detail with relations)
- `PATCH /api/admin/bookings/:id/status` (complete, no-show transitions)
- `GET /api/admin/clients` (paginated, searchable)
- `GET /api/admin/clients/:id/bookings` (history)

**Frontend work:**
- Daily view (receptionist primary screen) — timeline grouped by professional
- Booking detail view (modal or page)
- Status change actions (complete, no-show, cancel)
- New booking wizard (client lookup, service select, slot picker, confirm)
- Client list + client detail with booking history

**Why third:** This is the highest-value, highest-complexity phase. It requires the new admin booking endpoints. The slot picker reuses the existing availability query endpoint.

### Phase N+4: Calendar + Dashboard

Polish and analytics.

**Backend work:**
- `GET /api/admin/dashboard/summary` (aggregation: today's bookings, revenue, upcoming count)

**Frontend work:**
- Calendar view (weekly/daily, all professionals)
- Dashboard page with summary cards and charts
- Settings page (salon info, working hours defaults)

**Why last:** Dashboard and calendar are valuable but not blocking. The receptionist can work from the daily view. The admin can work from the booking list. Calendar and dashboard are enhancements.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Two Separate React Apps

**What:** Building separate apps for admin and receptionist.
**Why bad:** Shared components duplicated, two build processes, two deployments, shared auth logic copied.
**Instead:** One app with role-filtered routes and navigation.

### Anti-Pattern 2: Duplicating Business Logic in Frontend

**What:** Reimplementing slot calculation, conflict detection, or validation rules in React.
**Why bad:** Logic drift between frontend and backend, bugs when they disagree.
**Instead:** Frontend calls API for all business logic. The slot picker calls `GET /api/bookings/available-slots`, it does NOT calculate slots locally.

### Anti-Pattern 3: Storing JWT in Cookies (httpOnly)

**What:** Using httpOnly cookies for JWT storage to "be more secure."
**Why bad:** Requires CSRF protection, complicates the API client, unnecessary for an admin-only internal tool.
**Instead:** Store in memory (Zustand store) with localStorage backup for page refresh. The 8h expiry is sufficient. This is an internal tool, not a public-facing app.

### Anti-Pattern 4: Building API Endpoints That Only the Frontend Uses

**What:** Creating `/api/admin/calendar-data` that returns a bespoke structure matching the calendar component's expected format.
**Why bad:** Couples backend to frontend component library. If calendar library changes, backend must change.
**Instead:** Return standard booking data from `/api/admin/bookings?startDate=X&endDate=Y`. Transform to calendar format in the frontend.

### Anti-Pattern 5: Real-Time WebSocket Updates

**What:** Adding WebSocket/SSE for real-time booking updates in the dashboard.
**Why bad:** Over-engineered for a single-salon with 1-3 concurrent users. Adds significant complexity.
**Instead:** TanStack Query's `refetchInterval` (polling every 30-60 seconds) is perfectly adequate. Add WebSockets only if there is a proven need (multiple simultaneous receptionists experiencing stale data).

---

## Scalability Considerations

This is a single-salon internal tool. Scalability is NOT a concern.

| Concern | Reality | Approach |
|---------|---------|----------|
| Concurrent users | 1-3 (admin + receptionist) | No special handling needed |
| Data volume | ~50 bookings/day max | Pagination on lists is sufficient |
| Real-time updates | Not needed for 1-3 users | TanStack Query polling at 30s intervals |
| Asset caching | Important for VPS bandwidth | Vite builds with content hashes, Express static with cache headers |
| Bundle size | Moderate concern on slower VPS connections | Code splitting by route (React.lazy) |

---

## Confidence Assessment

| Area | Confidence | Basis |
|------|------------|-------|
| Serving strategy (Express static) | HIGH | Standard pattern, verified Vite docs; avoids OrchestratorAI's Vite-dev-in-production mistake |
| Auth flow (JWT + role) | HIGH | Backend already has JWT auth; role field is a one-line schema addition |
| API client pattern (TanStack Query) | HIGH | Industry standard for React SPAs in 2025-2026 |
| Role-based single app | HIGH | Standard RBAC pattern, well-documented |
| Project structure (monorepo with frontend/) | HIGH | Matches team's existing OrchestratorAI pattern |
| Calendar library choice | MEDIUM | Needs evaluation during implementation — multiple viable options |
| Build order | HIGH | Clear dependency chain from integration point analysis |

---

## Sources

### Primary
- Existing codebase analysis: `src/app.js`, `src/middleware/auth.js`, `src/routes/admin/auth.js`, `prisma/schema.prisma`
- [Vite Build Documentation](https://vite.dev/guide/build)
- [Vite Backend Integration Guide](https://vite.dev/guide/backend-integration)

### Secondary
- [TanStack Router vs React Router comparison (2026)](https://medium.com/ekino-france/tanstack-router-vs-react-router-v7-32dddc4fcd58)
- [React UI Libraries comparison 2025](https://makersden.io/blog/react-ui-libs-2025-comparing-shadcn-radix-mantine-mui-chakra)
- [React + Express + Vite same port pattern](https://dev.to/herudi/single-port-spa-react-and-express-using-vite-same-port-in-dev-or-prod-2od4)
- [Role-based access in React](https://blog.openreplay.com/role-based-access-in-react/)

---
*Research completed: 2026-03-13*
