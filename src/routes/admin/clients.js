import { Router } from 'express';
import { z } from 'zod';

import { adminAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { listClients } from '../../services/clientService.js';

const router = Router();

// All client admin endpoints require JWT auth
router.use(adminAuth);

// Async wrapper to forward thrown errors to Express error handler
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

const listQuerySchema = z.object({
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/**
 * GET /api/admin/clients
 * List clients with optional search and pagination.
 * Returns { data: { clients, total, page, limit } }.
 */
router.get(
  '/',
  validate({ query: listQuerySchema }),
  asyncHandler(async (req, res) => {
    const result = await listClients(req.query);
    res.json({ data: result });
  })
);

export default router;
