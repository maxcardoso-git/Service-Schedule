import { Router } from 'express';
import { z } from 'zod';

import { apiKeyAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { listActiveServices, getServiceById } from '../services/serviceService.js';

const router = Router();

// All public service endpoints require a valid API key
router.use(apiKeyAuth);

// Async wrapper to forward thrown errors to Express error handler
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

/**
 * @openapi
 * /api/services:
 *   get:
 *     tags: [Services]
 *     summary: List all active services
 *     responses:
 *       200:
 *         description: Array of active services with assigned professionals
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                       name:
 *                         type: string
 *                       durationMinutes:
 *                         type: integer
 *                       price:
 *                         type: number
 *                       active:
 *                         type: boolean
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const services = await listActiveServices();
    res.json({ data: services });
  })
);

/**
 * @openapi
 * /api/services/{id}:
 *   get:
 *     tags: [Services]
 *     summary: Get service by ID with assigned professionals
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Service ID
 *     responses:
 *       200:
 *         description: Service details with professionals
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
 *                     name:
 *                       type: string
 *                     durationMinutes:
 *                       type: integer
 *                     price:
 *                       type: number
 *                     active:
 *                       type: boolean
 *                     professionals:
 *                       type: array
 *                       items:
 *                         type: object
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get(
  '/:id',
  validate({
    params: z.object({
      id: z.string().uuid(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const service = await getServiceById(req.params.id);
    res.json({ data: service });
  })
);

export default router;
