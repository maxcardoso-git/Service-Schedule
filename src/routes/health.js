import { Router } from 'express';
import prisma from '../lib/prisma.js';

const router = Router();

/**
 * @openapi
 * /api/health:
 *   get:
 *     tags: [Health]
 *     summary: API health check
 *     description: Returns API status and database connectivity. Always returns 200.
 *     security: []
 *     responses:
 *       200:
 *         description: Health status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 database:
 *                   type: string
 *                   enum: [connected, disconnected]
 */
router.get('/', async (req, res) => {
  let database = 'connected';

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    database = 'disconnected';
  }

  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    database,
  });
});

export default router;
