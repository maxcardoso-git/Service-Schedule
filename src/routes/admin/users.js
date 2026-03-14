import { Router } from 'express';
import { z } from 'zod';

import { adminAuth, requireRole } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import {
  listAdminUsers,
  createAdminUser,
  updateAdminUser,
} from '../../services/adminUserService.js';

const router = Router();

// All user management endpoints require JWT auth + ADMIN role
router.use(adminAuth);
router.use(requireRole('ADMIN'));

// Async wrapper to forward thrown errors to Express error handler
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

const createUserSchema = z.object({
  name: z.string().min(2).max(200),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['ADMIN', 'RECEPTIONIST']),
});

const updateUserSchema = z.object({
  name: z.string().min(2).max(200).optional(),
  role: z.enum(['ADMIN', 'RECEPTIONIST']).optional(),
  active: z.boolean().optional(),
});

/**
 * GET /api/admin/users
 * List all admin users (id, name, email, role, active, createdAt).
 * Requires ADMIN role.
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const users = await listAdminUsers();
    res.json({ data: users });
  })
);

/**
 * POST /api/admin/users
 * Create a new admin user with hashed password.
 * Returns 201 { data: user }.
 * Requires ADMIN role.
 */
router.post(
  '/',
  validate({ body: createUserSchema }),
  asyncHandler(async (req, res) => {
    const user = await createAdminUser(req.body);
    res.status(201).json({ data: user });
  })
);

/**
 * PATCH /api/admin/users/:id
 * Update an admin user's name, role, or active status.
 * Returns 200 { data: user } or 404 ADMIN_USER_NOT_FOUND.
 * Requires ADMIN role.
 */
router.patch(
  '/:id',
  validate({
    params: z.object({ id: z.string().uuid() }),
    body: updateUserSchema,
  }),
  asyncHandler(async (req, res) => {
    const user = await updateAdminUser(req.params.id, req.body);
    res.json({ data: user });
  })
);

export default router;
