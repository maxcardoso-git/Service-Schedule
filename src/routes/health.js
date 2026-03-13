import { Router } from 'express';
import prisma from '../lib/prisma.js';

const router = Router();

/**
 * GET /api/health
 * Returns API status and database connectivity check.
 * Always returns 200 — never crashes on DB failure.
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
