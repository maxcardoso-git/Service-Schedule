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
import { getBookingsByConversationId } from '../services/conversationService.js';

const router = Router();
router.use(apiKeyAuth);

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

/**
 * @openapi
 * /api/bookings:
 *   get:
 *     tags: [Bookings]
 *     summary: Get bookings by conversation ID
 *     parameters:
 *       - in: query
 *         name: conversationId
 *         required: true
 *         schema:
 *           type: string
 *           minLength: 1
 *         description: Conversation session identifier
 *     responses:
 *       200:
 *         description: Array of bookings linked to the conversation
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 */
// CONV-02 — get bookings by conversation session
router.get('/',
  validate({
    query: z.object({
      conversationId: z.string().min(1),
    }),
  }),
  asyncHandler(async (req, res) => {
    const bookings = await getBookingsByConversationId(req.query.conversationId);
    res.json({ data: bookings });
  })
);

/**
 * @openapi
 * /api/bookings/availability:
 *   post:
 *     tags: [Bookings]
 *     summary: Check available time slots
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [professionalId, serviceId, date]
 *             properties:
 *               professionalId:
 *                 type: string
 *                 format: uuid
 *               serviceId:
 *                 type: string
 *                 format: uuid
 *               date:
 *                 type: string
 *                 pattern: '^\d{4}-\d{2}-\d{2}$'
 *                 example: '2026-03-15'
 *     responses:
 *       200:
 *         description: Available slots for the given date
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 */
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

/**
 * @openapi
 * /api/bookings:
 *   post:
 *     tags: [Bookings]
 *     summary: Create a pre-reservation booking
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
 *                 maxLength: 255
 *               conversationId:
 *                 type: string
 *                 maxLength: 255
 *     responses:
 *       201:
 *         description: Booking created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       409:
 *         $ref: '#/components/responses/Conflict'
 */
// SCHD-02, INFR-03 — create pre-reservation with TTL
router.post('/',
  validate({
    body: z.object({
      clientId: z.string().uuid(),
      professionalId: z.string().uuid(),
      serviceId: z.string().uuid(),
      startTime: z.string().datetime(),
      idempotencyKey: z.string().max(255).optional(),
      conversationId: z.string().max(255).optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const booking = await createPreReservation(req.body);
    res.status(201).json({ data: booking });
  })
);

/**
 * @openapi
 * /api/bookings/{id}/confirm:
 *   patch:
 *     tags: [Bookings]
 *     summary: Confirm a pre-reserved booking
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Booking ID
 *     responses:
 *       200:
 *         description: Booking confirmed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
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

/**
 * @openapi
 * /api/bookings/{id}/cancel:
 *   patch:
 *     tags: [Bookings]
 *     summary: Cancel a booking
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Booking ID
 *     responses:
 *       200:
 *         description: Booking cancelled
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
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

/**
 * @openapi
 * /api/bookings/by-phone/{phone}:
 *   get:
 *     tags: [Bookings]
 *     summary: Get bookings by client phone number
 *     parameters:
 *       - in: path
 *         name: phone
 *         required: true
 *         schema:
 *           type: string
 *           minLength: 8
 *           maxLength: 20
 *         description: Client phone number
 *     responses:
 *       200:
 *         description: Array of bookings for the client
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 */
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
