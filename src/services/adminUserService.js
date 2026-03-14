import bcrypt from 'bcryptjs';

import prisma from '../lib/prisma.js';
import { NotFoundError } from '../lib/errors.js';

/** Fields returned for admin users — never includes password. */
const adminUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  active: true,
  createdAt: true,
};

/**
 * List all admin users ordered by name ascending.
 * @returns {Promise<Array>} Admin user records (no password field).
 */
export async function listAdminUsers() {
  return prisma.adminUser.findMany({
    select: adminUserSelect,
    orderBy: { name: 'asc' },
  });
}

/**
 * Create a new admin user with a hashed password.
 * Prisma unique constraint on email will throw naturally (errorHandler → 409).
 *
 * @param {{ name: string, email: string, password: string, role: string }} data
 * @returns {Promise<Object>} Created admin user (no password field).
 */
export async function createAdminUser({ name, email, password, role }) {
  const hashedPassword = await bcrypt.hash(password, 10);

  return prisma.adminUser.create({
    data: {
      name,
      email,
      password: hashedPassword,
      role,
    },
    select: adminUserSelect,
  });
}

/**
 * Update an existing admin user's name, role, or active status.
 * Password updates are NOT allowed through this function (stripped if present).
 *
 * @param {string} id - UUID of the admin user.
 * @param {Object} updates - Fields to update (name, role, active).
 * @returns {Promise<Object>} Updated admin user (no password field).
 * @throws {NotFoundError} If no user with that id exists.
 */
export async function updateAdminUser(id, updates) {
  const existing = await prisma.adminUser.findUnique({ where: { id } });

  if (!existing) {
    throw new NotFoundError('Admin user not found', 'ADMIN_USER_NOT_FOUND');
  }

  // Strip password field — password changes are not permitted here
  const { password: _stripped, ...safeUpdates } = updates;

  return prisma.adminUser.update({
    where: { id },
    data: safeUpdates,
    select: adminUserSelect,
  });
}
