import { Router } from 'express';
import { z } from 'zod';
import { apiKeyAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  getAvailableSlots,
  createPreReservation,
  confirmBooking,
  cancelBooking,
  getBookingsByPhone,
} from '../services/bookingService.js';

const router = Router();
router.use(apiKeyAuth);

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// SCHD-01, SCHD-06 — availability query
router.post('/availability',
  validate({
    body: z.object({
      professionalId: z.string().uuid(),
      serviceId: z.string().uuid(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { professionalId, serviceId, date } = req.body;
    const result = await getAvailableSlots(professionalId, serviceId, date);
    res.json({ data: result });
  })
);

// SCHD-02, INFR-03 — create pre-reservation with TTL
router.post('/',
  validate({
    body: z.object({
      clientId: z.string().uuid(),
      professionalId: z.string().uuid(),
      serviceId: z.string().uuid(),
      startTime: z.string().datetime(),
      idempotencyKey: z.string().max(255).optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const booking = await createPreReservation(req.body);
    res.status(201).json({ data: booking });
  })
);

// SCHD-03 — confirm booking
router.patch('/:id/confirm',
  validate({
    params: z.object({ id: z.string().uuid() }),
  }),
  asyncHandler(async (req, res) => {
    const booking = await confirmBooking(req.params.id);
    res.json({ data: booking });
  })
);

// SCHD-04 — cancel booking
router.patch('/:id/cancel',
  validate({
    params: z.object({ id: z.string().uuid() }),
  }),
  asyncHandler(async (req, res) => {
    const booking = await cancelBooking(req.params.id);
    res.json({ data: booking });
  })
);

// SCHD-05 — get bookings by client phone
router.get('/by-phone/:phone',
  validate({
    params: z.object({ phone: z.string().min(8).max(20) }),
  }),
  asyncHandler(async (req, res) => {
    const bookings = await getBookingsByPhone(req.params.phone);
    res.json({ data: bookings });
  })
);

export default router;
