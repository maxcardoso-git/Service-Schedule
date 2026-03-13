import { Router } from 'express';
import { z } from 'zod';

import { apiKeyAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { listActiveServices, getServiceById } from '../services/serviceService.js';

const router = Router();

// All public service endpoints require a valid API key
router.use(apiKeyAuth);

// Async wrapper to forward thrown errors to Express error handler
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

/**
 * GET /api/services
 * List all active services.
 * Returns 200 { data: [...] }.
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const services = await listActiveServices();
    res.json({ data: services });
  })
);

/**
 * GET /api/services/:id
 * Get a service by ID, including assigned professionals.
 * Returns 200 { data: service } or 404 SERVICE_NOT_FOUND.
 */
router.get(
  '/:id',
  validate({
    params: z.object({
      id: z.string().uuid(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const service = await getServiceById(req.params.id);
    res.json({ data: service });
  })
);

export default router;
