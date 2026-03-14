# Phase 5: Frontend Foundation + Auth - Research

**Researched:** 2026-03-14
**Domain:** React 19 + Vite 8 frontend scaffolding, JWT auth integration, Express static serving, role-based access
**Confidence:** HIGH

## Summary

This phase scaffolds the React frontend in a `frontend/` subdirectory, integrates JWT authentication with role-based routing, adds the `role` column to `AdminUser`, configures CORS for development, and serves the production build from Express. The backend already has JWT auth (`adminAuth` middleware), a login endpoint, and the `cors` package installed but unconfigured.

The existing codebase uses a consistent pattern: `Router` + `adminAuth` middleware + `validate()` + `asyncHandler` wrapper + service layer. All new backend routes must follow this exact pattern. The frontend uses plain JavaScript (not TypeScript) per project decision, with shadcn/ui + Tailwind v4 for UI components.

**Primary recommendation:** Start with backend changes (role migration, CORS config, requireRole middleware, new endpoints), then scaffold the frontend, then build login + auth flow, then wire up admin user management as the first CRUD proof.

## Standard Stack

### Core (Phase 5 scope only)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | ^19.2.4 | UI framework | Decided in project research, greenfield project |
| React DOM | ^19.2.4 | DOM rendering | Paired with React 19 |
| Vite | ^8.0.0 | Build tool / dev server | create-vite 8.3.0 available, Rolldown bundler |
| @vitejs/plugin-react | ^6.0.1 | React Fast Refresh | Standard Vite + React integration |
| react-router-dom | ^7.13.1 | Client-side routing | v7 stable, supports createBrowserRouter + nested layouts |
| @tanstack/react-query | ^5.90.21 | Server state / data fetching | Caching, refetch, loading/error states |
| zustand | ^5.0.11 | Client state (auth, UI) | Lightweight, no Provider boilerplate |
| tailwindcss | ^4.2.1 | Utility CSS | v4 with CSS-first config |
| @tailwindcss/vite | latest | Vite plugin for Tailwind v4 | Replaces PostCSS plugin in v4 |
| lucide-react | ^0.577.0 | Icons | Tree-shakeable, consistent with OrchestratorAI |
| class-variance-authority | ^0.7.1 | Variant styling | Required by shadcn/ui |
| clsx | ^2.1.1 | Class merging | Used with tailwind-merge |
| tailwind-merge | ^3.5.0 | Tailwind class dedup | Prevents utility conflicts |
| sonner | ^2.0.7 | Toast notifications | Simple API, shadcn/ui integration |

### Backend additions (already in package.json)

| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| cors | ^2.8.6 | CORS middleware | Already installed, used as `cors()` with no config |
| bcryptjs | ^2.4.3 | Password hashing | Already installed, used in auth |
| jsonwebtoken | ^9.0.3 | JWT signing/verify | Already installed, used in auth |

### Not needed for Phase 5

| Library | Why Deferred |
|---------|-------------|
| FullCalendar | Phase 7+ (calendar view) |
| react-hook-form | Phase 6+ (service/professional CRUD forms) |
| @hookform/resolvers | Phase 6+ |
| date-fns | Phase 6+ (calendar/booking display) |

**Installation (Phase 5 frontend):**
```bash
# Create Vite project
npm create vite@latest frontend -- --template react

cd frontend

# Tailwind v4 + Vite plugin
npm install -D tailwindcss@^4.2.1 @tailwindcss/vite

# Core dependencies
npm install react-router-dom@^7.13.1
npm install @tanstack/react-query@^5.90.21
npm install zustand@^5.0.11

# UI utilities (needed for shadcn/ui components)
npm install lucide-react class-variance-authority clsx tailwind-merge sonner

# shadcn/ui init (after Tailwind is configured)
npx shadcn@latest init
npx shadcn@latest add button card input label
```

## Architecture Patterns

### Project Structure (Phase 5 scope)

```
Service-schedule/
├── prisma/schema.prisma          # ADD role to AdminUser
├── src/                          # Backend (existing)
│   ├── app.js                    # ADD: CORS config, static serving, new route mounts
│   ├── middleware/
│   │   ├── auth.js               # ADD: requireRole() function
│   │   └── ...existing...
│   ├── routes/admin/
│   │   ├── auth.js               # MODIFY: JWT payload reads user.role
│   │   ├── users.js              # NEW: admin user CRUD
│   │   ├── clients.js            # NEW: GET /api/admin/clients (list)
│   │   ├── bookings.js           # NEW: PATCH /api/admin/bookings/:id/status
│   │   ├── dashboard.js          # NEW: GET /api/admin/dashboard/stats
│   │   └── ...existing...
│   └── services/
│       ├── clientService.js      # ADD: listClients()
│       ├── bookingService.js     # ADD: updateBookingStatus()
│       └── adminUserService.js   # NEW: admin user CRUD service
├── frontend/                     # NEW - entire directory
│   ├── package.json
│   ├── vite.config.js
│   ├── jsconfig.json
│   ├── index.html
│   ├── src/
│   │   ├── main.jsx
│   │   ├── App.jsx
│   │   ├── app.css               # Tailwind v4 imports + shadcn theme
│   │   ├── lib/
│   │   │   ├── api.js            # apiFetch wrapper with JWT
│   │   │   └── utils.js          # cn() helper for shadcn
│   │   ├── stores/
│   │   │   └── authStore.js      # Zustand: token, user, login/logout
│   │   ├── components/
│   │   │   ├── ui/               # shadcn/ui components (auto-generated)
│   │   │   ├── layout/
│   │   │   │   ├── AppLayout.jsx # Sidebar + header + Outlet
│   │   │   │   ├── Sidebar.jsx   # Role-filtered navigation
│   │   │   │   └── Header.jsx    # User name, logout button
│   │   │   └── ProtectedRoute.jsx
│   │   └── pages/
│   │       ├── Login.jsx
│   │       ├── admin/
│   │       │   ├── Dashboard.jsx # Placeholder with stats
│   │       │   └── Users.jsx     # Admin user management
│   │       └── NotFound.jsx
│   └── components.json          # shadcn/ui config
```

### Pattern 1: Backend Route Pattern (established)

Every admin route in the project follows this exact pattern. New routes MUST match it.

```javascript
// Source: src/routes/admin/services.js (existing code)
import { Router } from 'express';
import { z } from 'zod';
import { adminAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { someService } from '../../services/someService.js';

const router = Router();
router.use(adminAuth);

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

router.get('/', asyncHandler(async (req, res) => {
  const items = await someService();
  res.json({ data: items });
}));

export default router;
```

**Key observations from existing code:**
- `asyncHandler` is defined locally in each route file (not shared)
- Responses always wrap in `{ data: ... }` or `{ error: { code, message } }`
- Validation schemas use Zod, passed to `validate()` middleware
- `adminAuth` is applied at router level with `router.use(adminAuth)`
- Service layer functions throw `NotFoundError`, `ValidationError`, etc.

### Pattern 2: requireRole() Middleware

```javascript
// Source: pattern derived from existing auth.js + ForbiddenError
// ADD to src/middleware/auth.js

import { ForbiddenError } from '../lib/errors.js';

/**
 * Role-based authorization middleware.
 * Must be used AFTER adminAuth (req.admin must exist).
 * @param {...string} roles - Allowed roles
 */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.admin || !roles.includes(req.admin.role)) {
      throw new ForbiddenError('Insufficient permissions', 'FORBIDDEN');
    }
    next();
  };
}
```

**Usage in routes:**
```javascript
router.use(adminAuth);

// All users can list
router.get('/', asyncHandler(async (req, res) => { ... }));

// Only admins can create
router.post('/', requireRole('ADMIN'), asyncHandler(async (req, res) => { ... }));
```

### Pattern 3: Vite Config with Proxy (development)

```javascript
// frontend/vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
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
    outDir: 'dist',
  },
});
```

**IMPORTANT:** The backend runs on port 3150 (from .env `PORT=3100` but project context says 3150 on VPS). Verify the actual port before configuring proxy. The `.env` currently says `PORT=3100`.

### Pattern 4: Express Static File Serving (production)

```javascript
// Add to src/app.js AFTER all API routes, BEFORE errorHandler
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Serve frontend build in production
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '..', 'frontend', 'dist');
  app.use(express.static(distPath));

  // SPA fallback: non-API routes serve index.html
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// Global error handler — MUST remain last
app.use(errorHandler);
```

### Pattern 5: Auth Store (Zustand)

```javascript
// frontend/src/stores/authStore.js
import { create } from 'zustand';

export const useAuthStore = create((set) => ({
  token: localStorage.getItem('token'),
  user: null, // { id, email, name, role }

  login: (token, admin) => {
    localStorage.setItem('token', token);
    set({ token, user: admin });
  },

  logout: () => {
    localStorage.removeItem('token');
    set({ token: null, user: null });
  },

  // Decode JWT payload on init (no library needed)
  initFromToken: () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      // Check expiry
      if (payload.exp * 1000 < Date.now()) {
        localStorage.removeItem('token');
        set({ token: null, user: null });
        return;
      }
      set({ token, user: { id: payload.id, email: payload.email, role: payload.role } });
    } catch {
      localStorage.removeItem('token');
      set({ token: null, user: null });
    }
  },
}));
```

### Pattern 6: API Client with 401 Redirect

```javascript
// frontend/src/lib/api.js
import { useAuthStore } from '@/stores/authStore';

class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function apiFetch(path, options = {}) {
  const token = useAuthStore.getState().token;

  const res = await fetch(`/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (res.status === 401) {
    useAuthStore.getState().logout();
    window.location.href = '/login';
    throw new ApiError(401, 'UNAUTHORIZED', 'Session expired');
  }

  const data = await res.json();

  if (!res.ok) {
    throw new ApiError(res.status, data.error?.code, data.error?.message);
  }

  return data;
}
```

**Note:** In development, `/api` is proxied by Vite to `http://localhost:3150`. In production, same origin (Express serves both).

### Pattern 7: Protected Route Component

```jsx
// frontend/src/components/ProtectedRoute.jsx
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

export function ProtectedRoute({ roles }) {
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);

  if (!token) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user?.role)) return <Navigate to="/" replace />;

  return <Outlet />;
}
```

### Pattern 8: Router Setup with createBrowserRouter

```jsx
// frontend/src/App.jsx
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AppLayout } from '@/components/layout/AppLayout';
import Login from '@/pages/Login';
import Dashboard from '@/pages/admin/Dashboard';
import Users from '@/pages/admin/Users';
import NotFound from '@/pages/NotFound';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: '/', element: <Dashboard /> },
          { path: '/admin/users', element: <ProtectedRoute roles={['ADMIN']} />,
            children: [
              { index: true, element: <Users /> },
            ],
          },
        ],
      },
    ],
  },
  { path: '*', element: <NotFound /> },
]);

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
```

### Anti-Patterns to Avoid

- **Separate admin/receptionist React apps:** One app, role-filtered routes and nav items
- **TypeScript in frontend:** Project decision is JavaScript; shadcn/ui components will install as JSX, rename `.tsx` to `.jsx` if needed
- **Duplicating asyncHandler:** Each route file defines its own (project convention, don't centralize)
- **httpOnly cookie JWT:** Unnecessary for internal admin tool; localStorage + Zustand is fine
- **CORS wildcard in production:** Not needed; same-origin when Express serves frontend

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Toast notifications | Custom toast system | sonner | Handles stacking, animations, dismiss timers |
| CSS class merging | Manual string concat | clsx + tailwind-merge via cn() | Prevents Tailwind utility conflicts |
| Component primitives | Custom dialog/dropdown | shadcn/ui (Radix underneath) | Accessibility, keyboard nav, focus trapping |
| Server state caching | Manual cache/refetch | @tanstack/react-query | Dedup, background refetch, loading states |
| JWT payload reading | jwt-decode library | `JSON.parse(atob(token.split('.')[1]))` | One line, no dependency needed |
| Form state on login | Manual useState per field | Even for login, keep it simple with useState (react-hook-form deferred to Phase 6) | Login form has 2 fields, not worth a library |

## Common Pitfalls

### Pitfall 1: CORS Not Configured for Dev Server
**What goes wrong:** Frontend on port 5173 calls backend on port 3150, browser blocks the request.
**Why it happens:** Backend has `app.use(cors())` with no origin config -- `cors()` with no args allows ALL origins, so this actually works by default. BUT if you add origin restrictions later, dev breaks.
**How to avoid:** Configure CORS explicitly with allowed origins:
```javascript
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? false  // same-origin, no CORS needed
    : ['http://localhost:5173'],
  credentials: true,
}));
```
**Warning signs:** `Access-Control-Allow-Origin` errors in browser console.

### Pitfall 2: SPA Fallback Catches API 404s
**What goes wrong:** A request to `/api/nonexistent` returns `index.html` instead of a JSON 404.
**Why it happens:** The SPA catch-all `app.get('*', ...)` runs after API routes but catches everything.
**How to avoid:** The catch-all MUST check `if (req.path.startsWith('/api')) return next()` to skip API paths. This lets the error handler return proper JSON 404s.
**Warning signs:** API calls returning HTML content type.

### Pitfall 3: Role Enum vs String
**What goes wrong:** Frontend sends `'admin'` (lowercase), backend has `'ADMIN'` (uppercase), comparison fails.
**Why it happens:** Inconsistent casing between JWT payload and database values.
**How to avoid:** Use an enum in Prisma (`enum AdminRole { ADMIN RECEPTIONIST }`), store uppercase, JWT carries uppercase, frontend compares uppercase. Standardize on UPPERCASE everywhere.

### Pitfall 4: JWT Hardcoded Role
**What goes wrong:** Login endpoint always returns `role: 'admin'` in JWT regardless of user's actual role.
**Why it happens:** Current code has `role: 'admin'` hardcoded (line 41 of `src/routes/admin/auth.js`).
**How to avoid:** Change to `role: user.role` after adding the role column. The login response should also include role in the admin object.
**Warning signs:** All users appear as admin in the frontend.

### Pitfall 5: shadcn/ui Components Install as TypeScript
**What goes wrong:** `npx shadcn@latest add button` generates `.tsx` files, project uses `.jsx`.
**Why it happens:** shadcn/ui defaults to TypeScript.
**How to avoid:** During `npx shadcn@latest init`, when prompted, select "no" for TypeScript. If components still generate as `.tsx`, rename to `.jsx` and remove type annotations. The `--force` flag may be needed during component installation.
**Warning signs:** Build errors about TypeScript syntax in `.tsx` files.

### Pitfall 6: Tailwind v4 Config Differences
**What goes wrong:** Creating `tailwind.config.js` file that is ignored by Tailwind v4.
**Why it happens:** Tailwind v4 uses CSS-first configuration (`@import 'tailwindcss'` in CSS), NOT a JavaScript config file.
**How to avoid:** Use the `@tailwindcss/vite` plugin and configure via CSS file. The `tailwind.config.js` file is NOT used in v4.
**Warning signs:** Tailwind classes not applying, no error messages.

### Pitfall 7: Rate Limiter Blocking Frontend
**What goes wrong:** Admin user gets rate-limited after a few rapid API calls (100 per 15 min default).
**Why it happens:** Global rate limiter applies to all routes including admin API calls.
**How to avoid:** Either increase the limit for admin routes or apply rate limiting selectively (skip for authenticated admin requests).
**Warning signs:** 429 Too Many Requests responses during normal admin usage.

## Code Examples

### AdminUser Role Migration

```prisma
// prisma/schema.prisma — MODIFY AdminUser model
enum AdminRole {
  ADMIN
  RECEPTIONIST
}

model AdminUser {
  id        String    @id @default(uuid()) @db.Uuid
  name      String    @db.VarChar(200)
  email     String    @unique @db.VarChar(255)
  password  String    @db.VarChar(255)
  role      AdminRole @default(RECEPTIONIST)
  active    Boolean   @default(true)
  createdAt DateTime  @default(now()) @db.Timestamptz
  updatedAt DateTime  @updatedAt @db.Timestamptz

  @@map("admin_users")
}
```

**Migration command:**
```bash
npx prisma migrate dev --name add-admin-role
```

**IMPORTANT:** Existing admin users need to be set to `ADMIN` role. The migration should include a SQL statement:
```sql
-- In the migration file, after adding the column:
UPDATE admin_users SET role = 'ADMIN' WHERE role IS NULL OR role = 'RECEPTIONIST';
```

Or handle this by making the default `ADMIN` for the migration, then changing default to `RECEPTIONIST` in schema after.

### Updated Login Endpoint

```javascript
// src/routes/admin/auth.js — MODIFY jwt.sign call
const token = jwt.sign(
  { id: user.id, email: user.email, role: user.role },  // user.role from DB
  process.env.JWT_SECRET,
  { expiresIn: '8h' }
);

res.status(200).json({
  token,
  admin: {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,  // Include role in response
  },
});
```

### CORS Configuration

```javascript
// src/app.js — REPLACE app.use(cors()) with:
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? false  // same-origin in production, CORS not needed
    : ['http://localhost:5173'],
  credentials: true,
}));
```

### Admin Users Route (NEW)

```javascript
// src/routes/admin/users.js
import { Router } from 'express';
import { z } from 'zod';
import { adminAuth, requireRole } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import {
  listAdminUsers,
  createAdminUser,
  updateAdminUser,
} from '../../services/adminUserService.js';

const router = Router();
router.use(adminAuth);
router.use(requireRole('ADMIN'));  // ALL user management is admin-only

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// GET /api/admin/users — list all admin users
router.get('/', asyncHandler(async (req, res) => {
  const users = await listAdminUsers();
  res.json({ data: users });
}));

// POST /api/admin/users — create new admin/receptionist
router.post('/',
  validate({
    body: z.object({
      name: z.string().min(2).max(200),
      email: z.string().email(),
      password: z.string().min(6),
      role: z.enum(['ADMIN', 'RECEPTIONIST']),
    }),
  }),
  asyncHandler(async (req, res) => {
    const user = await createAdminUser(req.body);
    res.status(201).json({ data: user });
  })
);

// PATCH /api/admin/users/:id — update user (name, role, active)
router.patch('/:id',
  validate({
    params: z.object({ id: z.string().uuid() }),
    body: z.object({
      name: z.string().min(2).max(200).optional(),
      role: z.enum(['ADMIN', 'RECEPTIONIST']).optional(),
      active: z.boolean().optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const user = await updateAdminUser(req.params.id, req.body);
    res.json({ data: user });
  })
);

export default router;
```

### Admin User Service (NEW)

```javascript
// src/services/adminUserService.js
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma.js';
import { NotFoundError } from '../lib/errors.js';

export async function listAdminUsers() {
  return prisma.adminUser.findMany({
    select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
    orderBy: { name: 'asc' },
  });
}

export async function createAdminUser({ name, email, password, role }) {
  const hashedPassword = await bcrypt.hash(password, 10);
  return prisma.adminUser.create({
    data: { name, email, password: hashedPassword, role },
    select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
  });
}

export async function updateAdminUser(id, updates) {
  const user = await prisma.adminUser.findUnique({ where: { id } });
  if (!user) throw new NotFoundError('Admin user not found', 'USER_NOT_FOUND');

  return prisma.adminUser.update({
    where: { id },
    data: updates,
    select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
  });
}
```

### Admin Clients Route (NEW, Phase 5 scope)

```javascript
// src/routes/admin/clients.js
import { Router } from 'express';
import { z } from 'zod';
import { adminAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { listClients } from '../../services/clientService.js';

const router = Router();
router.use(adminAuth);

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// GET /api/admin/clients?search=&page=1&limit=20
router.get('/',
  validate({
    query: z.object({
      search: z.string().optional(),
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(20),
    }),
  }),
  asyncHandler(async (req, res) => {
    const result = await listClients(req.query);
    res.json({ data: result });
  })
);

export default router;
```

### Dashboard Stats Endpoint (NEW)

```javascript
// src/routes/admin/dashboard.js
import { Router } from 'express';
import { adminAuth } from '../../middleware/auth.js';
import prisma from '../../lib/prisma.js';

const router = Router();
router.use(adminAuth);

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// GET /api/admin/dashboard/stats
router.get('/stats', asyncHandler(async (req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [todayBookings, totalClients, totalProfessionals, pendingPayments] = await Promise.all([
    prisma.booking.count({
      where: { startTime: { gte: today, lt: tomorrow }, status: { in: ['CONFIRMED', 'PRE_RESERVED'] } },
    }),
    prisma.client.count(),
    prisma.professional.count({ where: { active: true } }),
    prisma.payment.count({ where: { status: 'PENDING' } }),
  ]);

  res.json({
    data: { todayBookings, totalClients, totalProfessionals, pendingPayments },
  });
}));

export default router;
```

### Booking Status Update Endpoint (NEW)

```javascript
// src/routes/admin/bookings.js
import { Router } from 'express';
import { z } from 'zod';
import { adminAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { updateBookingStatus } from '../../services/bookingService.js';

const router = Router();
router.use(adminAuth);

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// PATCH /api/admin/bookings/:id/status
router.patch('/:id/status',
  validate({
    params: z.object({ id: z.string().uuid() }),
    body: z.object({
      status: z.enum(['CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW']),
    }),
  }),
  asyncHandler(async (req, res) => {
    const booking = await updateBookingStatus(req.params.id, req.body.status);
    res.json({ data: booking });
  })
);

export default router;
```

### shadcn/ui CSS Setup (Tailwind v4)

```css
/* frontend/src/app.css */
@import 'tailwindcss';

/* shadcn/ui theme variables */
:root {
  --background: hsl(0 0% 100%);
  --foreground: hsl(0 0% 3.9%);
  --card: hsl(0 0% 100%);
  --card-foreground: hsl(0 0% 3.9%);
  --popover: hsl(0 0% 100%);
  --popover-foreground: hsl(0 0% 3.9%);
  --primary: hsl(0 0% 9%);
  --primary-foreground: hsl(0 0% 98%);
  --secondary: hsl(0 0% 96.1%);
  --secondary-foreground: hsl(0 0% 9%);
  --muted: hsl(0 0% 96.1%);
  --muted-foreground: hsl(0 0% 45.1%);
  --accent: hsl(0 0% 96.1%);
  --accent-foreground: hsl(0 0% 9%);
  --destructive: hsl(0 84.2% 60.2%);
  --destructive-foreground: hsl(0 0% 98%);
  --border: hsl(0 0% 89.8%);
  --input: hsl(0 0% 89.8%);
  --ring: hsl(0 0% 3.9%);
  --radius: 0.5rem;
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
}
```

### jsconfig.json for Path Aliases

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

### cn() Utility for shadcn/ui

```javascript
// frontend/src/lib/utils.js
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| tailwind.config.js (JS config) | CSS-first config with `@import 'tailwindcss'` | Tailwind v4 (Jan 2025) | No JS config file; use `@theme` in CSS |
| postcss-tailwindcss plugin | `@tailwindcss/vite` plugin | Tailwind v4 | Simpler Vite integration |
| tailwindcss-animate | tw-animate-css | shadcn/ui Tailwind v4 update | Animation library changed |
| BrowserRouter + Routes | createBrowserRouter + RouterProvider | React Router v6.4+ / v7 | Data APIs, better code splitting |
| Separate CORS + frontend server | Express serves static build | Best practice for monolith | Single process, no CORS in production |

## Open Questions

1. **Backend port: 3100 vs 3150**
   - What we know: `.env` says `PORT=3100`, project context says port 3150 on VPS
   - What's unclear: Which port is actually used in production
   - Recommendation: Check VPS config. For dev, use whatever `.env` says (3100). Vite proxy target should match.

2. **shadcn/ui JavaScript mode with Tailwind v4**
   - What we know: shadcn/ui init supports "no TypeScript" option; Tailwind v4 support confirmed
   - What's unclear: Whether the combination of JS + Tailwind v4 has rough edges (most guides show TS)
   - Recommendation: Test during scaffolding. If components generate as `.tsx`, rename and strip types. The `--force` flag may be needed.

3. **Existing admin users after migration**
   - What we know: AdminUser records exist (seed file creates them), no role column currently
   - What's unclear: How many exist, whether they should all be ADMIN
   - Recommendation: Migration should default to `ADMIN` for existing records, then set schema default to `RECEPTIONIST` for new users going forward.

4. **Rate limiter impact on frontend**
   - What we know: Global rate limit is 100 req / 15 min
   - What's unclear: Whether admin dashboard use will hit this limit
   - Recommendation: Probably fine for 1-3 users. Monitor and adjust if needed. Can exempt authenticated admin routes later.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `src/app.js`, `src/middleware/auth.js`, `src/routes/admin/auth.js`, `prisma/schema.prisma`, `src/routes/admin/services.js`, `src/routes/admin/professionals.js`, `src/routes/clients.js`, `src/services/clientService.js`, `src/lib/errors.js`
- [shadcn/ui Vite installation guide](https://ui.shadcn.com/docs/installation/vite)
- [shadcn/ui Tailwind v4 guide](https://ui.shadcn.com/docs/tailwind-v4)
- [Vite server.proxy documentation](https://vite.dev/config/server-options)
- Project-level research: `.planning/research/STACK.md`, `.planning/research/ARCHITECTURE.md`

### Secondary (MEDIUM confidence)
- [React Router v7 protected routes patterns](https://dev.to/ra1nbow1/building-reliable-protected-routes-with-react-router-v7-1ka0)
- [shadcn/ui with JavaScript (no TypeScript) guide](https://dev.to/skidee/how-to-use-shadcn-with-react-javascript-no-typescript-189i)
- [create-vite npm registry](https://www.npmjs.com/package/create-vite) - v8.3.0 confirmed

### Tertiary (LOW confidence)
- Tailwind v4 + shadcn/ui JS-only combination (most community examples use TypeScript; JS path less tested)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Versions verified via npm, project decisions locked
- Architecture patterns: HIGH - Derived from existing codebase patterns, verified with official docs
- Backend changes: HIGH - Direct analysis of existing code, clear modification points
- Frontend scaffolding: HIGH - Official shadcn/ui + Vite docs
- Tailwind v4 + JS (no TS): MEDIUM - Official docs confirm support but community examples mostly use TS
- Pitfalls: HIGH - Identified from actual codebase analysis (hardcoded role, CORS, rate limiter)

**Research date:** 2026-03-14
**Valid until:** 2026-04-14 (30 days - stable technologies)
