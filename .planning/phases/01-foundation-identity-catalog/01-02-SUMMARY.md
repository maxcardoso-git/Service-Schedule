---
phase: 01-foundation-identity-catalog
plan: 02
subsystem: auth
tags: [express, jwt, bcryptjs, zod, prisma, api-key, middleware, seed]

# Dependency graph
requires:
  - phase: 01-foundation-identity-catalog/01-01
    provides: Express app scaffold, Prisma schema, error classes, logger, prisma client

provides:
  - apiKeyAuth middleware for agent request authentication via X-API-Key header
  - adminAuth middleware for JWT Bearer token verification on admin routes
  - validate() Zod middleware factory for request body/query/params validation
  - errorHandler global middleware converting AppError/Prisma/unknown errors to structured envelope
  - GET /api/health endpoint with database connectivity check
  - POST /api/admin/auth/login endpoint returning JWT on valid credentials
  - AdminUser Prisma model (admin_users table)
  - Beauty salon seed data: 5 services, 3 professionals, working hours, 1 admin user

affects:
  - 01-03 (catalog routes depend on apiKeyAuth + validate + errorHandler)
  - 01-04 (booking routes depend on apiKeyAuth + adminAuth + validate + errorHandler)
  - all future plans (error envelope contract established here)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "apiKeyAuth: compare X-API-Key header against process.env.API_KEY, throw UnauthorizedError on mismatch"
    - "adminAuth: verify JWT Bearer token, attach decoded payload to req.admin"
    - "validate(schema): Zod safeParse on body/query/params, throw ValidationError with fieldErrors on failure"
    - "errorHandler: instanceof AppError → use statusCode+code; P2002 → 409 CONFLICT; else → 500 INTERNAL_ERROR"
    - "Seed with upsert for idempotency: safe to run multiple times"
    - "Admin routes use next(err) pattern; middleware throws for synchronous errors"

key-files:
  created:
    - src/middleware/auth.js
    - src/middleware/validate.js
    - src/middleware/errorHandler.js
    - src/routes/health.js
    - src/routes/admin/auth.js
    - prisma/seed.js
  modified:
    - src/app.js
    - prisma/schema.prisma
    - package.json

key-decisions:
  - "AdminUser model added to Prisma schema (not separate config file) — consistent with existing Prisma-first pattern"
  - "Health check always returns 200 even if DB disconnected — avoids false-positive load balancer failures"
  - "apiKeyAuth NOT applied globally — applied per-route in Plans 03/04 to allow health + admin-auth without key"
  - "errorHandler uses details: undefined (omitted) when null — keeps envelope clean for AI agent parsing"

patterns-established:
  - "Error envelope: { error: { code, message, details? } } — machine-readable, AI-agent-friendly"
  - "Async route handlers use try/catch + next(err) to forward errors to errorHandler"
  - "Synchronous middleware throws directly (Express 5 compatible pattern)"
  - "Seed uses upsert with unique compound keys for idempotency"

# Metrics
duration: 4min
completed: 2026-03-13
---

# Phase 1 Plan 02: Auth Infrastructure and Seed Data Summary

**API key + JWT auth middleware, Zod validation factory, structured error handler, health check endpoint, admin login, and beauty salon seed data using bcryptjs + jsonwebtoken + Zod**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-13T20:51:23Z
- **Completed:** 2026-03-13T20:55:00Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- Auth middleware layer: apiKeyAuth (X-API-Key) and adminAuth (JWT Bearer) for two-tier access control
- Zod validation middleware factory with field-level error details in structured envelope
- Global error handler that converts all error types to `{ error: { code, message, details? } }` machine-readable format
- Admin login end-to-end: bcrypt password comparison, JWT signing (8h), structured response
- Beauty salon seed data: 5 services, 3 professionals, Mon-Sat working hours, 6 professional-service assignments, 1 admin

## Task Commits

Each task was committed atomically:

1. **Task 1: Create middleware and health check** - `1f31080` (feat)
2. **Task 2: Admin login endpoint and seed data** - `953ab7d` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified

- `src/middleware/auth.js` - apiKeyAuth (X-API-Key) and adminAuth (JWT Bearer) middleware
- `src/middleware/validate.js` - Zod validation factory for body/query/params
- `src/middleware/errorHandler.js` - Global error handler; AppError, P2002, unknown → structured envelope
- `src/routes/health.js` - GET /api/health with database connectivity check
- `src/routes/admin/auth.js` - POST /api/admin/auth/login with Zod validation + bcrypt + JWT
- `prisma/seed.js` - Beauty salon demo: 5 services, 3 professionals, working hours, 1 admin
- `src/app.js` - Mount health route, admin auth route, and error handler
- `prisma/schema.prisma` - Added AdminUser model (admin_users table)
- `package.json` - Added prisma.seed config

## Decisions Made

- AdminUser model added directly to Prisma schema (not a separate config or JSON file) — consistent with the Prisma-first pattern established in Plan 01-01.
- Health check always returns HTTP 200 even when database is disconnected — database field reflects status but 200 prevents false-positive load balancer alerts.
- apiKeyAuth is NOT applied globally — it will be applied per-route in Plans 03/04, allowing health and admin-auth endpoints to function without an API key.
- Error `details` field omitted (not set to `null`) when not present, keeping the envelope clean for AI agent parsing.

## Deviations from Plan

None - plan executed exactly as written. The AdminUser model addition was explicitly called for in the plan's Task 2 action.

## Issues Encountered

Port 3100 was already in use from Plan 01-01 server session — killed the existing process before starting verification. No code changes required.

## User Setup Required

None - no external service configuration required. Seed data uses environment variables already set in `.env` from Plan 01-01.

## Next Phase Readiness

- All middleware ready for Plans 03/04 (catalog and booking routes)
- apiKeyAuth, validate(), adminAuth, and errorHandler can be imported immediately
- Seed data populated — database ready for domain operations
- No blockers for Plan 01-03

---
*Phase: 01-foundation-identity-catalog*
*Completed: 2026-03-13*
