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
 * - revenueToday: sum of BookingService prices for today's CONFIRMED + COMPLETED bookings
 * - noShowCount: count of NO_SHOW bookings today
 * - occupancyPercent: (non-cancelled bookings today / (active professionals * 16 slots)) * 100, capped at 100
 */
router.get(
  '/stats',
  asyncHandler(async (_req, res) => {
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    const todayEnd = new Date();
    todayEnd.setUTCHours(23, 59, 59, 999);

    const [
      todayBookings,
      totalClients,
      totalProfessionals,
      pendingPayments,
      revenueTodayResult,
      noShowCount,
      nonCancelledToday,
    ] = await Promise.all([
      // Existing: CONFIRMED + PRE_RESERVED bookings today
      prisma.booking.count({
        where: {
          startTime: { gte: todayStart, lte: todayEnd },
          status: { in: ['CONFIRMED', 'PRE_RESERVED'] },
        },
      }),

      // Existing: total clients
      prisma.client.count(),

      // Existing: active professionals
      prisma.professional.count({ where: { active: true } }),

      // Existing: pending payments
      prisma.payment.count({ where: { status: 'PENDING' } }),

      // New: sum of booking_services prices for today's revenue (CONFIRMED + COMPLETED)
      prisma.$queryRaw`
        SELECT COALESCE(SUM(bs.price), 0) AS revenue
        FROM booking_services bs
        INNER JOIN bookings b ON b.id = bs."bookingId"
        WHERE b."startTime" >= ${todayStart}
          AND b."startTime" <= ${todayEnd}
          AND b.status IN ('CONFIRMED', 'COMPLETED')
      `,

      // New: no-show count today
      prisma.booking.count({
        where: {
          startTime: { gte: todayStart, lte: todayEnd },
          status: 'NO_SHOW',
        },
      }),

      // New: non-cancelled bookings today (for occupancy numerator)
      prisma.booking.count({
        where: {
          startTime: { gte: todayStart, lte: todayEnd },
          status: { notIn: ['CANCELLED'] },
        },
      }),
    ]);

    // revenueToday: raw query returns array with one row; parse Decimal to number
    const revenueToday = Number(revenueTodayResult[0]?.revenue ?? 0);

    // occupancyPercent: assume 8h workday with 30-min slots = 16 slots per professional
    const SLOTS_PER_PRO = 16;
    const totalSlots = totalProfessionals * SLOTS_PER_PRO;
    const occupancyPercent =
      totalSlots > 0 ? Math.min(100, Math.round((nonCancelledToday / totalSlots) * 100)) : 0;

    res.json({
      data: {
        todayBookings,
        totalClients,
        totalProfessionals,
        pendingPayments,
        revenueToday,
        noShowCount,
        occupancyPercent,
      },
    });
  })
);

export default router;
