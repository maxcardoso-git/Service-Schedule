import { Router } from 'express';
import { z } from 'zod';

import { adminAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import {
  listClients,
  findClientByPhone,
  createClient,
  getClientAppointments,
} from '../../services/clientService.js';

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

/**
 * GET /api/admin/clients/by-phone/:phone
 * Look up a client by phone number.
 * Returns { data: client } or 404 if not found.
 * IMPORTANT: Must be declared BEFORE /:id routes to avoid Express treating "by-phone" as a UUID param.
 */
router.get(
  '/by-phone/:phone',
  validate({
    params: z.object({ phone: z.string().min(8).max(20) }),
  }),
  asyncHandler(async (req, res) => {
    const client = await findClientByPhone(req.params.phone);
    res.json({ data: client });
  })
);

/**
 * POST /api/admin/clients
 * Register a new client.
 * Returns 201 { data: client }.
 */
router.post(
  '/',
  validate({
    body: z.object({
      name: z.string().min(2).max(200),
      phone: z.string().min(8).max(20),
      email: z.string().email().optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const client = await createClient(req.body);
    res.status(201).json({ data: client });
  })
);

/**
 * GET /api/admin/clients/:id/appointments
 * Get all appointments for a client by UUID.
 * Returns { data: appointments[] }.
 */
router.get(
  '/:id/appointments',
  validate({
    params: z.object({ id: z.string().uuid() }),
  }),
  asyncHandler(async (req, res) => {
    const appointments = await getClientAppointments(req.params.id);
    res.json({ data: appointments });
  })
);

export default router;
