import { Router } from 'express';

import { adminAuth } from '../../middleware/auth.js';
import prisma from '../../lib/prisma.js';

const router = Router();

// All dashboard endpoints require JWT auth
router.use(adminAuth);

// Async wrapper to forward thrown errors to Express error handler
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

/**
 * GET /api/admin/dashboard/stats
 * Returns key operational metrics:
 * - todayBookings: count of CONFIRMED + PRE_RESERVED bookings for today
 * - totalClients: total number of clients in the system
 * - totalProfessionals: count of active professionals
 * - pendingPayments: count of payments with PENDING status
 */
router.get(
  '/stats',
  asyncHandler(async (req, res) => {
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    const todayEnd = new Date();
    todayEnd.setUTCHours(23, 59, 59, 999);

    const [todayBookings, totalClients, totalProfessionals, pendingPayments] = await Promise.all([
      prisma.booking.count({
        where: {
          startTime: {
            gte: todayStart,
            lte: todayEnd,
          },
          status: { in: ['CONFIRMED', 'PRE_RESERVED'] },
        },
      }),
      prisma.client.count(),
      prisma.professional.count({ where: { active: true } }),
      prisma.payment.count({ where: { status: 'PENDING' } }),
    ]);

    res.json({
      data: {
        todayBookings,
        totalClients,
        totalProfessionals,
        pendingPayments,
      },
    });
  })
);

export default router;
