import { Router } from 'express';
import { z } from 'zod';
import { apiKeyAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  createPixIntent,
  getPaymentStatus,
  simulatePaid,
} from '../services/paymentService.js';

const router = Router();
router.use(apiKeyAuth);

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

/**
 * @openapi
 * /api/payments/pix:
 *   post:
 *     tags: [Payments]
 *     summary: Create PIX payment intent for a confirmed booking
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [bookingId]
 *             properties:
 *               bookingId:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       201:
 *         description: Payment intent created with PIX payload
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     bookingId:
 *                       type: string
 *                       format: uuid
 *                     amount:
 *                       type: number
 *                     status:
 *                       type: string
 *                       enum: [PENDING, PAID]
 *                     pixPayload:
 *                       type: string
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       409:
 *         $ref: '#/components/responses/Conflict'
 */
// PYMT-01 — create PIX payment intent for a confirmed booking
router.post('/pix',
  validate({
    body: z.object({
      bookingId: z.string().uuid(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const payment = await createPixIntent(req.body.bookingId);
    res.status(201).json({ data: payment });
  })
);

/**
 * @openapi
 * /api/payments/{id}/status:
 *   get:
 *     tags: [Payments]
 *     summary: Get payment status
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Payment ID
 *     responses:
 *       200:
 *         description: Payment status details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     status:
 *                       type: string
 *                       enum: [PENDING, PAID]
 *                     pixPayload:
 *                       type: string
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
// PYMT-02 — get payment status (includes pixPayload)
router.get('/:id/status',
  validate({
    params: z.object({ id: z.string().uuid() }),
  }),
  asyncHandler(async (req, res) => {
    const payment = await getPaymentStatus(req.params.id);
    res.json({ data: payment });
  })
);

/**
 * @openapi
 * /api/payments/{id}/simulate-paid:
 *   post:
 *     tags: [Payments]
 *     summary: Simulate payment received (PENDING to PAID)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Payment ID
 *     responses:
 *       200:
 *         description: Payment marked as paid
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     status:
 *                       type: string
 *                       example: PAID
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
// PYMT-03 — simulate payment received (PENDING → PAID)
router.post('/:id/simulate-paid',
  validate({
    params: z.object({ id: z.string().uuid() }),
  }),
  asyncHandler(async (req, res) => {
    const payment = await simulatePaid(req.params.id);
    res.json({ data: payment });
  })
);

export default router;
