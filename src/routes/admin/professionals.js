import { Router } from 'express';
import { z } from 'zod';

import { adminAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import {
  getProfessionalById,
  createProfessional,
  updateProfessional,
  assignService,
  removeService,
  replaceWorkingHours,
} from '../../services/professionalService.js';

const router = Router();

// All admin professional endpoints require JWT authentication
router.use(adminAuth);

// Async wrapper to forward thrown errors to Express error handler
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

const professionalBodySchema = z.object({
  name: z.string().min(2).max(200),
  email: z.string().email().optional(),
  phone: z.string().min(8).max(20).optional(),
});

const workingHoursSchema = z.object({
  hours: z.array(
    z.object({
      dayOfWeek: z.number().int().min(0).max(6),
      startTime: z.string().regex(/^\d{2}:\d{2}$/),
      endTime: z.string().regex(/^\d{2}:\d{2}$/),
    })
  ),
});

/**
 * GET /api/admin/professionals/:id
 * Get a professional by ID with services and working hours.
 * Returns 200 { data: professional } or 404 PROFESSIONAL_NOT_FOUND.
 */
router.get(
  '/:id',
  validate({
    params: z.object({ id: z.string().uuid() }),
  }),
  asyncHandler(async (req, res) => {
    const professional = await getProfessionalById(req.params.id);
    res.json({ data: professional });
  })
);

/**
 * POST /api/admin/professionals
 * Create a new professional.
 * Returns 201 { data: professional }.
 */
router.post(
  '/',
  validate({ body: professionalBodySchema }),
  asyncHandler(async (req, res) => {
    const professional = await createProfessional(req.body);
    res.status(201).json({ data: professional });
  })
);

/**
 * PUT /api/admin/professionals/:id
 * Update a professional profile (partial update supported).
 * Allowed fields: name, email, phone, active.
 * Returns 200 { data: professional } or 404 PROFESSIONAL_NOT_FOUND.
 */
router.put(
  '/:id',
  validate({
    params: z.object({ id: z.string().uuid() }),
    body: professionalBodySchema.extend({ active: z.boolean().optional() }).partial(),
  }),
  asyncHandler(async (req, res) => {
    const professional = await updateProfessional(req.params.id, req.body);
    res.json({ data: professional });
  })
);

/**
 * POST /api/admin/professionals/:id/services
 * Assign a service to a professional.
 * Returns 201 { data: assignment } or 404 if professional/service not found, 409 if already assigned.
 */
router.post(
  '/:id/services',
  validate({
    params: z.object({ id: z.string().uuid() }),
    body: z.object({ serviceId: z.string().uuid() }),
  }),
  asyncHandler(async (req, res) => {
    const assignment = await assignService(req.params.id, req.body.serviceId);
    res.status(201).json({ data: assignment });
  })
);

/**
 * DELETE /api/admin/professionals/:id/services/:serviceId
 * Remove a service assignment from a professional.
 * Returns 200 { data: { message } } or 404 ASSIGNMENT_NOT_FOUND.
 */
router.delete(
  '/:id/services/:serviceId',
  validate({
    params: z.object({
      id: z.string().uuid(),
      serviceId: z.string().uuid(),
    }),
  }),
  asyncHandler(async (req, res) => {
    await removeService(req.params.id, req.params.serviceId);
    res.json({ data: { message: 'Service removed from professional' } });
  })
);

/**
 * PUT /api/admin/professionals/:id/working-hours
 * Replace the working hours schedule for a professional (full replacement).
 * Returns 200 { data: { professionalId, hours } } or 404 PROFESSIONAL_NOT_FOUND.
 */
router.put(
  '/:id/working-hours',
  validate({
    params: z.object({ id: z.string().uuid() }),
    body: workingHoursSchema,
  }),
  asyncHandler(async (req, res) => {
    const result = await replaceWorkingHours(req.params.id, req.body.hours);
    res.json({ data: result });
  })
);

export default router;
