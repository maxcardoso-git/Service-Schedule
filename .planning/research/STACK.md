# Stack Research — AI Scheduling Platform

## Recommended Stack

Based on sibling OrchestratorAI production `package.json` (verified versions) and scheduling domain requirements.

### Runtime & Framework

| Technology | Version | Rationale | Confidence |
|-----------|---------|-----------|------------|
| **Node.js** | 20 LTS | Same as OrchestratorAI, stable LTS | HIGH |
| **Express** | ^4.21.2 | Proven, same as sibling project, Express 5 RC not yet stable | HIGH |
| **Prisma** | ^6.19.0 | Same ORM as OrchestratorAI, excellent PostgreSQL support, type-safe queries | HIGH |
| **@prisma/client** | ^6.19.0 | Generated client for DB access | HIGH |

### Database & Caching

| Technology | Version | Rationale | Confidence |
|-----------|---------|-----------|------------|
| **PostgreSQL** | 15+ | ACID compliance critical for booking conflict detection, partial unique indexes | HIGH |
| **pg** | ^8.16.3 | PostgreSQL driver (used by Prisma internally) | HIGH |
| **ioredis** | ^5.4.2 | Pre-reservation TTL pattern (`SET key EX seconds`), fast slot locking | HIGH |

### Background Jobs

| Technology | Version | Rationale | Confidence |
|-----------|---------|-----------|------------|
| **Bull** | ^4.16.5 | Delayed jobs for PIX payment simulation timeouts, slot expiry cleanup | HIGH |
| **node-cron** | ^4.2.1 | Periodic sweeps (expire stale pre-reservations) | MEDIUM |

### Authentication & Security

| Technology | Version | Rationale | Confidence |
|-----------|---------|-----------|------------|
| **jsonwebtoken** | ^9.0.2 | AI agent auth (API key → JWT validation) | HIGH |
| **bcryptjs** | ^2.4.3 | Admin/receptionist credential hashing | HIGH |
| **helmet** | ^8.0.0 | Security headers | HIGH |
| **cors** | ^2.8.5 | CORS for frontend admin (when built) | HIGH |
| **express-rate-limit** | ^7.5.0 | Rate limiting on API endpoints | HIGH |

### Validation & Utilities

| Technology | Version | Rationale | Confidence |
|-----------|---------|-----------|------------|
| **Zod** | ^3.24.2 | Request/response validation, same as OrchestratorAI | HIGH |
| **uuid** | ^11.1.0 | v7 UUIDs (time-ordered) for booking IDs | HIGH |
| **date-fns** | ^3.6.0 | Date manipulation for slot calculation (lightweight, tree-shakeable) | HIGH |
| **winston** | ^3.18.0 | Structured logging | HIGH |

### API Documentation

| Technology | Version | Rationale | Confidence |
|-----------|---------|-----------|------------|
| **swagger-jsdoc** | ^6.2.8 | API docs from JSDoc annotations | HIGH |
| **swagger-ui-express** | ^5.0.1 | Serve Swagger UI at /api-docs | HIGH |

### Development

| Technology | Version | Rationale | Confidence |
|-----------|---------|-----------|------------|
| **nodemon** | ^3.1.0 | Dev auto-reload | HIGH |
| **jest** | ^29.7.0 | Testing (same as OrchestratorAI) | HIGH |
| **dotenv** | ^16.4.7 | Environment config | HIGH |

---

## Critical Architecture Decision: Redis for TTL

**Why Redis is essential (not optional):**

The pre-reservation pattern requires reliable TTL-based expiry:

```
1. Agent reserves slot → SET booking:{id} EX 300 (5 min TTL)
2. PostgreSQL row created with status PRE_RESERVED
3. Redis key expires → Bull job triggers → DB row status → EXPIRED
4. If agent confirms before TTL → Redis DEL key → DB row status → CONFIRMED
```

**Pure PostgreSQL alternative** (if Redis unavailable):
- Store `expiresAt` timestamp on booking row
- node-cron runs every 30s to expire stale pre-reservations
- Less precise but functional for MVP

**Recommendation:** Start with PostgreSQL-only TTL (simpler), add Redis when concurrent booking volume requires it.

---

## Concurrent Slot Reservation Pattern

```sql
-- PostgreSQL partial unique index prevents double-booking at DB level
CREATE UNIQUE INDEX booking_slot_conflict
  ON bookings (professional_id, date, start_time)
  WHERE status IN ('PRE_RESERVED', 'CONFIRMED');

-- Booking creation uses SELECT FOR UPDATE to lock the check
BEGIN;
  SELECT 1 FROM bookings
  WHERE professional_id = $1 AND date = $2
    AND start_time < $3 AND end_time > $4
    AND status IN ('PRE_RESERVED', 'CONFIRMED')
  FOR UPDATE;

  -- If no conflict, insert
  INSERT INTO bookings (...) VALUES (...);
COMMIT;
```

---

## What NOT to Use

| Technology | Why Avoid |
|-----------|-----------|
| **MongoDB/Mongoose** | No ACID transactions — critical for booking conflict detection |
| **Sequelize** | Inferior to Prisma for PostgreSQL, more verbose, less type-safe |
| **node-schedule** | No persistence — scheduled jobs lost on restart |
| **Express 5 RC** | Not yet stable, unnecessary risk |
| **GraphQL** | Over-engineered for 8 well-defined REST endpoints consumed by AI agents |
| **Moment.js** | Deprecated, large bundle — use date-fns instead |
| **TypeORM** | Team familiar with Prisma, no reason to switch |

---

## Package.json Skeleton

```json
{
  "name": "service-schedule",
  "version": "1.0.0",
  "type": "module",
  "main": "src/server.js",
  "scripts": {
    "start": "node src/server.js",
    "dev": "nodemon src/server.js",
    "db:migrate": "prisma migrate dev",
    "db:seed": "prisma db seed",
    "test": "jest --experimental-vm-modules"
  },
  "dependencies": {
    "@prisma/client": "^6.19.0",
    "bcryptjs": "^2.4.3",
    "cors": "^2.8.5",
    "date-fns": "^3.6.0",
    "dotenv": "^16.4.7",
    "express": "^4.21.2",
    "express-rate-limit": "^7.5.0",
    "helmet": "^8.0.0",
    "jsonwebtoken": "^9.0.2",
    "swagger-jsdoc": "^6.2.8",
    "swagger-ui-express": "^5.0.1",
    "uuid": "^11.1.0",
    "winston": "^3.18.0",
    "zod": "^3.24.2"
  },
  "devDependencies": {
    "jest": "^29.7.0",
    "nodemon": "^3.1.0",
    "prisma": "^6.19.0"
  }
}
```

**Note:** Redis (ioredis) and Bull omitted from initial package.json — add when TTL pattern requires it (post-MVP).

---

## Confidence Assessment

| Area | Confidence | Basis |
|------|------------|-------|
| Core stack (Express + Prisma + PostgreSQL) | HIGH | Verified from sibling OrchestratorAI production package.json |
| Version numbers | HIGH | Pinned to OrchestratorAI production versions |
| Redis for TTL | MEDIUM | Correct pattern but PostgreSQL-only may suffice for MVP volume |
| Security middleware | HIGH | Standard Express security stack |
| What NOT to use | HIGH | Well-known trade-offs in Node.js ecosystem |

---
*Research completed: 2026-03-13*
