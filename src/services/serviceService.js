import prisma from '../lib/prisma.js';
import { NotFoundError } from '../lib/errors.js';

/**
 * List all active services, ordered alphabetically by name.
 * @returns {Promise<Array>} Array of active service records.
 */
export async function listActiveServices() {
  return prisma.service.findMany({
    where: { active: true },
    select: {
      id: true,
      name: true,
      description: true,
      durationMin: true,
      price: true,
    },
    orderBy: { name: 'asc' },
  });
}

/**
 * List ALL services (active and inactive), ordered alphabetically by name.
 * Used by admin management interface.
 * @returns {Promise<Array>} Array of all service records.
 */
export async function listAllServices() {
  return prisma.service.findMany({
    select: {
      id: true,
      name: true,
      description: true,
      durationMin: true,
      price: true,
      active: true,
      createdAt: true,
    },
    orderBy: { name: 'asc' },
  });
}

/**
 * Get a single service by ID, including its assigned professionals.
 * Only active professionals are returned in the professionals list.
 * @param {string} id - UUID of the service.
 * @returns {Promise<Object>} Service record with professionals.
 * @throws {NotFoundError} If no service with that ID exists.
 */
export async function getServiceById(id) {
  const service = await prisma.service.findUnique({
    where: { id },
    include: {
      professionals: {
        include: {
          professional: {
            select: { id: true, name: true, active: true },
          },
        },
      },
    },
  });

  if (!service) {
    throw new NotFoundError('Service not found', 'SERVICE_NOT_FOUND');
  }

  // Filter to active professionals only
  const result = {
    ...service,
    professionals: service.professionals
      .filter((ps) => ps.professional.active)
      .map((ps) => ps.professional),
  };

  return result;
}

/**
 * Create a new service.
 * @param {{ name: string, description?: string, durationMin: number, price: number }} data
 * @returns {Promise<Object>} Created service record.
 */
export async function createService({ name, description, durationMin, price }) {
  return prisma.service.create({
    data: {
      name,
      description: description ?? null,
      durationMin,
      price,
    },
  });
}

/**
 * Update an existing service.
 * Only name, description, durationMin, and price may be updated.
 * @param {string} id - UUID of the service.
 * @param {{ name?: string, description?: string, durationMin?: number, price?: number }} data
 * @returns {Promise<Object>} Updated service record.
 * @throws {NotFoundError} If no service with that ID exists.
 */
export async function updateService(id, data) {
  const existing = await prisma.service.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError('Service not found', 'SERVICE_NOT_FOUND');
  }

  const { name, description, durationMin, price, active } = data;
  const updateData = {};
  if (name !== undefined) updateData.name = name;
  if (description !== undefined) updateData.description = description;
  if (durationMin !== undefined) updateData.durationMin = durationMin;
  if (price !== undefined) updateData.price = price;
  if (active !== undefined) updateData.active = active;

  return prisma.service.update({ where: { id }, data: updateData });
}

/**
 * Deactivate a service (set active = false).
 * @param {string} id - UUID of the service.
 * @returns {Promise<Object>} Updated service record.
 * @throws {NotFoundError} If no service with that ID exists.
 */
export async function deactivateService(id) {
  const existing = await prisma.service.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError('Service not found', 'SERVICE_NOT_FOUND');
  }

  return prisma.service.update({ where: { id }, data: { active: false } });
}
