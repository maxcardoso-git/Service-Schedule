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
