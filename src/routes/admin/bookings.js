import { Router } from 'express';
import { z } from 'zod';

import { adminAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { updateBookingStatus } from '../../services/bookingService.js';

const router = Router();

// All booking admin endpoints require JWT auth
router.use(adminAuth);

// Async wrapper to forward thrown errors to Express error handler
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

/**
 * PATCH /api/admin/bookings/:id/status
 * Transition a booking's status.
 * Returns { data: booking } with client and service relations.
 */
router.patch(
  '/:id/status',
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
