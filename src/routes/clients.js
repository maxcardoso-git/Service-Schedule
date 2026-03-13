import { Router } from 'express';
import { z } from 'zod';

import { apiKeyAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  findClientByPhone,
  createClient,
  getClientAppointments,
} from '../services/clientService.js';

const router = Router();

// All client endpoints require a valid API key
router.use(apiKeyAuth);

// Async wrapper to forward thrown errors to Express error handler
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

/**
 * @openapi
 * /api/clients/by-phone/{phone}:
 *   get:
 *     tags: [Clients]
 *     summary: Look up client by phone number
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
 *         description: Client found
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
 *                     phone:
 *                       type: string
 *                     email:
 *                       type: string
 *                       nullable: true
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get(
  '/by-phone/:phone',
  validate({
    params: z.object({
      phone: z.string().min(8).max(20),
    }),
  }),
  asyncHandler(async (req, res) => {
    const client = await findClientByPhone(req.params.phone);
    res.json({ data: client });
  })
);

/**
 * @openapi
 * /api/clients:
 *   post:
 *     tags: [Clients]
 *     summary: Register a new client
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, phone]
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 200
 *               phone:
 *                 type: string
 *                 minLength: 8
 *                 maxLength: 20
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       201:
 *         description: Client created
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
 *                     phone:
 *                       type: string
 *                     email:
 *                       type: string
 *                       nullable: true
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       409:
 *         $ref: '#/components/responses/Conflict'
 */
router.post(
  '/',
  validate({
    body: z.object({
      name: z.string().min(2).max(200),
      phone: z.string().min(8).max(20),
      email: z.string().email().optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const client = await createClient(req.body);
    res.status(201).json({ data: client });
  })
);

/**
 * @openapi
 * /api/clients/{id}/appointments:
 *   get:
 *     tags: [Clients]
 *     summary: Get appointment history for a client
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Client ID
 *     responses:
 *       200:
 *         description: List of client appointments
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get(
  '/:id/appointments',
  validate({
    params: z.object({
      id: z.string().uuid(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const appointments = await getClientAppointments(req.params.id);
    res.json({ data: appointments });
  })
);

export default router;
