import { Router } from 'express';
import { z } from 'zod';

import { adminAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import {
  createService,
  updateService,
  deactivateService,
} from '../../services/serviceService.js';

const router = Router();

// All admin service endpoints require JWT authentication
router.use(adminAuth);

// Async wrapper to forward thrown errors to Express error handler
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

const serviceBodySchema = z.object({
  name: z.string().min(2).max(200),
  description: z.string().optional(),
  durationMin: z.number().int().min(5).max(480),
  price: z.number().positive(),
});

/**
 * POST /api/admin/services
 * Create a new service.
 * Returns 201 { data: service }.
 */
router.post(
  '/',
  validate({ body: serviceBodySchema }),
  asyncHandler(async (req, res) => {
    const service = await createService(req.body);
    res.status(201).json({ data: service });
  })
);

/**
 * PUT /api/admin/services/:id
 * Update an existing service (partial update supported).
 * Returns 200 { data: service } or 404 SERVICE_NOT_FOUND.
 */
router.put(
  '/:id',
  validate({
    params: z.object({ id: z.string().uuid() }),
    body: serviceBodySchema.partial(),
  }),
  asyncHandler(async (req, res) => {
    const service = await updateService(req.params.id, req.body);
    res.json({ data: service });
  })
);

/**
 * PATCH /api/admin/services/:id/deactivate
 * Deactivate a service (set active = false).
 * Returns 200 { data: service } or 404 SERVICE_NOT_FOUND.
 */
router.patch(
  '/:id/deactivate',
  validate({
    params: z.object({ id: z.string().uuid() }),
  }),
  asyncHandler(async (req, res) => {
    const service = await deactivateService(req.params.id);
    res.json({ data: service });
  })
);

export default router;
