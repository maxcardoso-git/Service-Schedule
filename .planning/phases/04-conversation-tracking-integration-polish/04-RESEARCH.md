# Phase 4: Conversation Tracking + Integration Polish - Research

**Researched:** 2026-03-13
**Domain:** Prisma schema design (nullable column vs. link table), swagger-jsdoc + swagger-ui-express, OpenAPI 3.0 annotation patterns, ESM compatibility
**Confidence:** HIGH for architecture decisions and Swagger stack; MEDIUM for swagger-jsdoc ESM workaround (verified from maintainer statements in GitHub issues)

---

## Summary

Phase 4 has two distinct sub-problems: (1) storing an optional `conversationId` per booking and exposing a query endpoint, and (2) generating OpenAPI documentation at `/api-docs`.

**Conversation tracking:** The roadmap proposes a `ConversationLink` table decoupled from the Booking model. Research confirms this is the correct approach for this use case. A nullable `conversationId` column on `Booking` is simpler but couples conversation concerns to the booking row, makes the filter query slightly more expensive (full-column index on a frequently-written table), and makes it harder to evolve independently. A separate `ConversationLink(id, bookingId, conversationId)` table is a clean one-to-one optional join, decoupled from the booking lifecycle, and trivially indexable. The tradeoff: one extra table and one extra join for the query endpoint. Given the explicit requirement that booking creation must not block when conversation tracking fails, the separate table is the right call — failure to write to `ConversationLink` can be caught and swallowed without touching the `Booking` record.

**Swagger/OpenAPI:** The standard stack is `swagger-jsdoc` + `swagger-ui-express`. The critical ESM issue: `swagger-jsdoc` v6.2.1 (current stable, last updated 2022) is published as CommonJS, and v7 is still in RC (v7.0.0-rc.6 as of research date). However, Node.js ESM can import CJS packages via default import — `import swaggerJsdoc from 'swagger-jsdoc'` works at runtime because Node.js CJS/ESM interop allows named default import of CJS modules. `swagger-ui-express` v5.0.2 is also CJS but is importable the same way. Both are confirmed to work in `"type": "module"` projects via default import.

**Primary recommendation:** Use a separate `ConversationLink` Prisma model for decoupled tracking. Use `swagger-jsdoc@6.2.1` + `swagger-ui-express@5.0.2` with default ESM imports; annotate routes with `@openapi` JSDoc comments co-located in route files.

---

## Standard Stack

### Core (already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@prisma/client` | 6.19.2 | ORM for ConversationLink model + migration | Already established |
| `zod` | 3.25.76 | Validate `conversationId` query param | Already established validate() pattern |
| `express` | 4.22.1 | Route for GET /api/bookings?conversationId= | Already established |

### New Dependencies Required
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `swagger-jsdoc` | `6.2.1` | Parses `@openapi` JSDoc comments, generates OpenAPI spec object | Dominant library for annotation-driven OpenAPI in Express; v6 is current stable |
| `swagger-ui-express` | `5.0.2` | Serves Swagger UI at `/api-docs` | Standard companion; v5.0.2 is current stable |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `swagger-jsdoc` (annotation-based) | Hand-write `openapi.yaml` | YAML is authoritative and version-controllable, but requires manual sync with code; JSDoc annotations keep docs co-located with routes |
| `swagger-jsdoc` | `express-jsdoc-swagger` | Less mature, smaller community |
| Separate `ConversationLink` table | Nullable `conversationId` column on `Booking` | Column is simpler but couples concerns; failure isolation requires try/catch that still touches the booking transaction |

**Installation:**
```bash
npm install swagger-jsdoc swagger-ui-express
```

---

## Architecture Patterns

### Recommended Project Structure Additions
```
src/
├── routes/
│   ├── bookings.js          # Add GET ?conversationId query + @openapi annotations
│   └── conversations.js     # (optional) or inline into bookings.js
├── services/
│   ├── bookingService.js    # Add getBookingsByConversationId()
│   └── conversationService.js  # createConversationLink() — isolated, swallowable
└── swagger.js               # swagger-jsdoc spec definition + swaggerUi setup export
```

### Pattern 1: ConversationLink Table (Decoupled One-to-One Optional)

**What:** A separate `ConversationLink` table holds the `(bookingId, conversationId)` pair. Writing to it is done after the booking is successfully created, wrapped in its own try/catch so failure does not roll back the booking.

**When to use:** When the linked concern (conversation tracking) is optional and must not block the primary operation (booking creation). Matches CONV-01 requirement exactly.

**Prisma schema:**
```prisma
// Source: Prisma docs — optional one-to-one via relation table pattern
model ConversationLink {
  id             String   @id @default(uuid()) @db.Uuid
  bookingId      String   @unique @db.Uuid
  conversationId String   @db.VarChar(255)
  createdAt      DateTime @default(now()) @db.Timestamptz

  booking Booking @relation(fields: [bookingId], references: [id], onDelete: Cascade)

  @@index([conversationId])
  @@map("conversation_links")
}
```

Add inverse side on `Booking`:
```prisma
model Booking {
  // ... existing fields ...
  conversationLink ConversationLink?
}
```

**Migration:** Standard `prisma migrate dev --name add_conversation_link` — no raw SQL needed; no partial indexes involved.

### Pattern 2: Booking Creation with Fire-and-Forget Conversation Link

**What:** Create the booking first. After commit, attempt to write ConversationLink. If that write fails, log and continue.

**When to use:** CONV-01 — "does not block booking creation if absent or if conversation tracking fails."

**Example:**
```js
// Source: project pattern established in bookingService.js
export async function createPreReservation(body) {
  const { conversationId, ...bookingFields } = body;

  // Primary booking creation (unchanged from existing pattern)
  const booking = await prisma.booking.create({ data: bookingFields });

  // Decoupled conversation link — failure must not surface to caller
  if (conversationId) {
    try {
      await prisma.conversationLink.create({
        data: { bookingId: booking.id, conversationId },
      });
    } catch (err) {
      // Log but do not throw — CONV-01 requirement
      logger.warn('Failed to create conversation link', { bookingId: booking.id, err: err.message });
    }
  }

  return booking;
}
```

### Pattern 3: Query Bookings by conversationId

**What:** `GET /api/bookings?conversationId=:id` returns all bookings linked to that OrchestratorAI session.

**Example:**
```js
// Source: existing project validate() + Prisma include pattern
router.get('/',
  validate({
    query: z.object({
      conversationId: z.string().min(1).optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { conversationId } = req.query;
    if (conversationId) {
      const bookings = await getBookingsByConversationId(conversationId);
      return res.json({ data: bookings });
    }
    // (optionally reject if no filter provided, or list all — decide at plan time)
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'conversationId required' } });
  })
);
```

```js
// Service layer
export async function getBookingsByConversationId(conversationId) {
  const links = await prisma.conversationLink.findMany({
    where: { conversationId },
    include: {
      booking: {
        include: { client: true, services: { include: { service: true } } },
      },
    },
  });
  return links.map(l => l.booking);
}
```

### Pattern 4: Swagger Setup with ESM CJS Interop

**What:** swagger-jsdoc v6 is CJS but can be default-imported in an ESM project. swagger-ui-express v5 likewise. Mount at `/api-docs` before the global error handler.

**Example:**
```js
// src/swagger.js — Source: swagger-jsdoc README + swagger-ui-express README
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'Service Schedule API',
      version: '1.0.0',
      description: 'AI-driven service scheduling API for OrchestratorAI agents',
    },
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'x-api-key',
        },
      },
    },
    security: [{ ApiKeyAuth: [] }],
  },
  apis: ['./src/routes/**/*.js', './src/routes/*.js'],
};

export const swaggerSpec = swaggerJsdoc(options);
export { swaggerUi };
```

```js
// src/app.js — mount before errorHandler
import { swaggerSpec, swaggerUi } from './swagger.js';
// ...
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
// ...
app.use(errorHandler);  // always last
```

### Pattern 5: Route-Level @openapi JSDoc Annotation

**What:** Co-locate OpenAPI docs with the route handler using `@openapi` YAML blocks.

**Example:**
```js
// Source: swagger-jsdoc README annotation pattern
/**
 * @openapi
 * /api/bookings:
 *   post:
 *     summary: Create a pre-reservation
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [clientId, professionalId, serviceId, startTime]
 *             properties:
 *               clientId:
 *                 type: string
 *                 format: uuid
 *               professionalId:
 *                 type: string
 *                 format: uuid
 *               serviceId:
 *                 type: string
 *                 format: uuid
 *               startTime:
 *                 type: string
 *                 format: date-time
 *               idempotencyKey:
 *                 type: string
 *               conversationId:
 *                 type: string
 *                 description: Optional OrchestratorAI session ID
 *     responses:
 *       201:
 *         description: Booking created
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 */
router.post('/', validate({...}), asyncHandler(async (req, res) => { ... }));
```

### Anti-Patterns to Avoid

- **Nullable `conversationId` directly on `Booking` model:** Couples conversation concerns to the booking row. If conversation write fails and you want to rollback only the link, you can't — it's the same row. Also adds a rarely-populated column to a high-write table.
- **Wrapping conversation link creation inside the booking transaction:** Defeats the CONV-01 requirement. If the link fails, the booking must still succeed.
- **Mounting `/api-docs` after `errorHandler`:** Express error handlers must be last. Mount Swagger before `errorHandler`.
- **Using swagger-jsdoc v7.0.0-rc.6:** It's still a pre-release candidate; stick with v6.2.1 stable.
- **Documenting only happy paths:** AI agents need accurate 400/409/404 response shapes to handle errors gracefully. Document error responses using `$ref` shared components.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OpenAPI spec generation | Hand-write openapi.yaml separately | `swagger-jsdoc` annotations | Manual YAML drifts from implementation; JSDoc stays co-located |
| Swagger UI serving | Serve raw Swagger UI dist files manually | `swagger-ui-express` | Handles CDN assets, custom options, multiple documents |
| Conversation-to-booking join | Custom raw SQL | Prisma `conversationLink.findMany` with `include: { booking }` | Prisma handles the join; raw SQL increases maintenance surface |

**Key insight:** The entire OpenAPI spec lives as JSDoc comments in the route files. Changes to a route's schema are reflected immediately on refresh of `/api-docs`.

---

## Common Pitfalls

### Pitfall 1: swagger-jsdoc v6 ESM CJS interop fails at runtime

**What goes wrong:** `import swaggerJsdoc from 'swagger-jsdoc'` throws `TypeError: swaggerJsdoc is not a function` or `ERR_REQUIRE_ESM` in some edge cases depending on how the CJS module's `module.exports` is structured.

**Why it happens:** Node.js ESM-to-CJS interop wraps the CJS `module.exports` as the default export. If swagger-jsdoc's main export is `module.exports = function(...)`, it imports fine. If it uses a named export pattern, the default import may be an object, not the function.

**How to avoid:** Test the import immediately in a scratch file. If the default import fails, use: `import swaggerJsdoc from 'swagger-jsdoc'; const spec = swaggerJsdoc.default ? swaggerJsdoc.default(opts) : swaggerJsdoc(opts);` — or use `createRequire` from `'module'` as a fallback.

**Warning signs:** `TypeError: swaggerJsdoc is not a function` at app startup.

### Pitfall 2: swagger-jsdoc `apis` glob does not match route files

**What goes wrong:** The swagger spec is generated with no paths — the UI shows an empty API.

**Why it happens:** The `apis` glob in swagger-jsdoc options is relative to the process CWD, not `__dirname`. If the app is started from a different directory, the glob resolves wrong.

**How to avoid:** Use `path.join(process.cwd(), 'src/routes/**/*.js')` or verify that npm start is always run from the project root. Test by logging `Object.keys(swaggerSpec.paths)` at startup.

**Warning signs:** `/api-docs` shows 0 paths defined.

### Pitfall 3: Conversation link creation silently fails without logging

**What goes wrong:** The try/catch swallows the error, conversationId is never stored, and there is no visibility into the failure.

**Why it happens:** The CONV-01 requirement says "does not block" — it's easy to misread this as "silently ignore."

**How to avoid:** Always `logger.warn(...)` inside the catch block with `bookingId` and the error message. This maintains the non-blocking contract while preserving observability.

**Warning signs:** `conversationId` query returns 0 bookings for a session known to have made bookings.

### Pitfall 4: Missing index on `conversationId` in ConversationLink

**What goes wrong:** CONV-02 queries (`WHERE conversationId = ?`) do full table scans as data grows.

**Why it happens:** Prisma does not add indexes automatically; you must declare `@@index([conversationId])` explicitly in the schema.

**How to avoid:** The Prisma schema above includes `@@index([conversationId])`. Verify the generated migration SQL contains `CREATE INDEX`.

**Warning signs:** Slow responses on `GET /api/bookings?conversationId=` in load testing.

### Pitfall 5: OpenAPI security not applied globally

**What goes wrong:** Swagger UI shows endpoints as having no security requirement, so AI agents assume the API is open.

**Why it happens:** The `security` field must be set at the top-level `definition` in swagger-jsdoc options AND each route that overrides it must redeclare it. If omitted at the definition level, no global default applies.

**How to avoid:** Set `security: [{ ApiKeyAuth: [] }]` at the `definition` level in swagger options. Individual routes inherit this automatically.

---

## Code Examples

### ConversationLink Prisma Schema (complete)
```prisma
// Source: Prisma docs — one-to-one optional relation via link table pattern
model ConversationLink {
  id             String   @id @default(uuid()) @db.Uuid
  bookingId      String   @unique @db.Uuid
  conversationId String   @db.VarChar(255)
  createdAt      DateTime @default(now()) @db.Timestamptz

  booking Booking @relation(fields: [bookingId], references: [id], onDelete: Cascade)

  @@index([conversationId])
  @@map("conversation_links")
}
```

### swagger.js Setup (ESM)
```js
// Source: swagger-jsdoc README + swagger-ui-express README
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const options = {
  definition: {
    openapi: '3.0.3',
    info: { title: 'Service Schedule API', version: '1.0.0' },
    components: {
      securitySchemes: {
        ApiKeyAuth: { type: 'apiKey', in: 'header', name: 'x-api-key' },
      },
      responses: {
        ValidationError: {
          description: 'Validation failed',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: {
                    type: 'object',
                    properties: {
                      code: { type: 'string', example: 'VALIDATION_ERROR' },
                      message: { type: 'string' },
                      details: { type: 'object' },
                    },
                  },
                },
              },
            },
          },
        },
        NotFound: {
          description: 'Resource not found',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: {
                    type: 'object',
                    properties: {
                      code: { type: 'string', example: 'NOT_FOUND' },
                      message: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    security: [{ ApiKeyAuth: [] }],
  },
  apis: ['./src/routes/**/*.js', './src/routes/*.js'],
};

export const swaggerSpec = swaggerJsdoc(options);
export { swaggerUi };
```

### app.js Integration (mount before errorHandler)
```js
// Source: swagger-ui-express README
import { swaggerSpec, swaggerUi } from './swagger.js';
// ...existing routes...
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
// MUST be last:
app.use(errorHandler);
```

### GET ?conversationId Route Handler
```js
// Source: project pattern (existing validate() + asyncHandler)
router.get('/',
  validate({
    query: z.object({
      conversationId: z.string().min(1).optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { conversationId } = req.query;
    if (!conversationId) {
      // Require a filter — prevents unbounded list
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'conversationId query parameter required' },
      });
    }
    const bookings = await getBookingsByConversationId(conversationId);
    res.json({ data: bookings });
  })
);
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| swagger-jsdoc v7.0.0-rc.x (ESM, unstable) | swagger-jsdoc v6.2.1 (CJS, stable, ESM-importable) | v7 never reached stable | Use v6; don't chase RC |
| swagger.yaml static file | JSDoc `@openapi` annotations in route files | Standard since swagger-jsdoc 3.x | Annotations stay co-located with code |
| Nullable FK on primary table | Separate link table for optional 1-to-1 | Best practice for decoupled optional relations | Failure isolation, clean schema evolution |

**Deprecated/outdated:**
- `@swagger` JSDoc tag: replaced by `@openapi` tag; swagger-jsdoc still supports both, but `@openapi` is the canonical name.

---

## Open Questions

1. **Should GET /api/bookings without conversationId list all bookings or return 400?**
   - What we know: CONV-02 only requires querying by conversationId. There is no requirement for a general listing endpoint.
   - What's unclear: Whether the AI agent might call GET /api/bookings without a filter for any other reason.
   - Recommendation: Return 400 if no `conversationId` provided — avoids unbounded result set, matches AI agent usage pattern.

2. **Does swagger-jsdoc v6 default import work without issues in this specific project?**
   - What we know: Node.js CJS/ESM interop allows default import of CJS modules. Issue #249 confirms maintainer endorses "use v6 for CJS projects via import".
   - What's unclear: Whether swagger-jsdoc v6's `module.exports` structure (function or object-with-default) creates a wrapping issue in Node 20.
   - Recommendation: Confirm at implementation time with a one-line test: `console.log(typeof swaggerJsdoc)` should print `'function'`. If it prints `'object'`, use `swaggerJsdoc.default(options)`.

3. **Should the Swagger UI be protected by apiKeyAuth?**
   - What we know: The route `/api/health` is public by design. No requirement specifies whether `/api-docs` should be gated.
   - What's unclear: Whether OrchestratorAI agents need unauthenticated access to the spec for introspection.
   - Recommendation: Leave `/api-docs` unauthenticated (standard practice for API documentation). The spec itself describes authenticated endpoints.

---

## Sources

### Primary (HIGH confidence)
- GitHub: github.com/Surnet/swagger-jsdoc — version status, ESM issue resolution (issue #249, maintainer statement)
- GitHub: github.com/scottie1984/swagger-ui-express — v5.0.2 release, Express 4 setup, README
- Prisma docs: prisma.io/docs — optional relations, @@index, onDelete: Cascade patterns

### Secondary (MEDIUM confidence)
- WebSearch: "nullable column vs link table one-to-one decoupled" — multiple sources agree on decoupled table for optional optional relations
- WebSearch: swagger-jsdoc ESM CJS interop — consistent pattern across multiple Stack Overflow and GitHub discussions
- WebFetch: swagger-ui-express package.json (raw GitHub) — confirmed CJS, v5.0.2, Express 4 peer dep

### Tertiary (LOW confidence)
- WebSearch: swagger-jsdoc ESM "import swaggerJsdoc from" runtime behavior — confirmed by multiple community examples but not by official swagger-jsdoc ESM documentation (no such doc exists for v6)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions confirmed from GitHub releases pages
- Architecture (ConversationLink table): HIGH — matches project constraints (CONV-01 failure isolation), verified against Prisma relation docs
- Swagger ESM interop: MEDIUM — confirmed via maintainer statement in issue #249 and Node.js CJS/ESM interop specification, but runtime behavior in this specific project should be spot-checked at task start
- Pitfalls: HIGH — derived from verified library behavior and project-specific patterns

**Research date:** 2026-03-13
**Valid until:** 2026-04-13 (swagger-jsdoc is low-activity; v6 stable, unlikely to change)
