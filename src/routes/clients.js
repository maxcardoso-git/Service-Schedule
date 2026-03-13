import { Router } from 'express';
import { z } from 'zod';

import { apiKeyAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  findClientByPhone,
  createClient,
  getClientAppointments,
} from '../services/clientService.js';

const router = Router();

// All client endpoints require a valid API key
router.use(apiKeyAuth);

// Async wrapper to forward thrown errors to Express error handler
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

/**
 * GET /api/clients/by-phone/:phone
 * Look up a client by phone number.
 * Returns 200 { data: client } or 404 CLIENT_NOT_FOUND.
 */
router.get(
  '/by-phone/:phone',
  validate({
    params: z.object({
      phone: z.string().min(8).max(20),
    }),
  }),
  asyncHandler(async (req, res) => {
    const client = await findClientByPhone(req.params.phone);
    res.json({ data: client });
  })
);

/**
 * POST /api/clients
 * Register a new client.
 * Returns 201 { data: client } or 409 CONFLICT on duplicate phone.
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
 * GET /api/clients/:id/appointments
 * Retrieve appointment history for a client.
 * Returns 200 { data: [...] } (empty array if no bookings) or 404 if client not found.
 */
router.get(
  '/:id/appointments',
  validate({
    params: z.object({
      id: z.string().uuid(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const appointments = await getClientAppointments(req.params.id);
    res.json({ data: appointments });
  })
);

export default router;
