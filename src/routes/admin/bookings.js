import { Router } from 'express';
import { z } from 'zod';

import { adminAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import prisma from '../../lib/prisma.js';
import {
  updateBookingStatus,
  getAvailableSlots,
  createPreReservation,
} from '../../services/bookingService.js';

const router = Router();

// All booking admin endpoints require JWT auth
router.use(adminAuth);

// Async wrapper to forward thrown errors to Express error handler
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

const bookingStatus = z.enum(['PRE_RESERVED', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW']);

const listQuerySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD')
    .optional(),
  professionalId: z.string().uuid().optional(),
  status: bookingStatus.optional(),
});

/**
 * GET /api/admin/bookings
 * List bookings with optional filters: date, professionalId, status.
 * Returns { data: bookings[] } with client, service, and professional relations.
 */
router.get(
  '/',
  validate({ query: listQuerySchema }),
  asyncHandler(async (req, res) => {
    const { date, professionalId, status } = req.query;

    const where = {};

    if (date) {
      const dayStart = new Date(`${date}T00:00:00Z`);
      const dayEnd = new Date(`${date}T23:59:59.999Z`);
      where.startTime = { gte: dayStart, lte: dayEnd };
    }

    if (professionalId) {
      where.professionalId = professionalId;
    }

    if (status) {
      where.status = status;
    }

    const bookings = await prisma.booking.findMany({
      where,
      include: {
        client: { select: { id: true, name: true, phone: true } },
        services: { include: { service: { select: { id: true, name: true, durationMin: true } } } },
        professional: { select: { id: true, name: true } },
      },
      orderBy: { startTime: 'asc' },
    });

    res.json({ data: bookings });
  })
);

/**
 * POST /api/admin/bookings/availability
 * Check available time slots (JWT-authenticated mirror of the apiKey endpoint).
 * Body: { professionalId: uuid, serviceId: uuid, date: YYYY-MM-DD }
 */
router.post(
  '/availability',
  validate({
    body: z.object({
      professionalId: z.string().uuid(),
      serviceId: z.string().uuid(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { professionalId, serviceId, date } = req.body;
    const result = await getAvailableSlots(professionalId, serviceId, date);
    res.json({ data: result });
  })
);

/**
 * POST /api/admin/bookings
 * Create a pre-reservation (JWT-authenticated mirror of the apiKey endpoint).
 * Body: { clientId, professionalId, serviceId, startTime, endTime?, idempotencyKey? }
 */
router.post(
  '/',
  validate({
    body: z.object({
      clientId: z.string().uuid(),
      professionalId: z.string().uuid(),
      serviceId: z.string().uuid(),
      startTime: z.string().datetime(),
      endTime: z.string().datetime().optional(),
      idempotencyKey: z.string().max(255).optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const booking = await createPreReservation(req.body);
    res.status(201).json({ data: booking });
  })
);

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
