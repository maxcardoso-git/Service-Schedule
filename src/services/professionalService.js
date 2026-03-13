import prisma from '../lib/prisma.js';
import { NotFoundError, ValidationError } from '../lib/errors.js';

/**
 * Validate that a string matches "HH:MM" 24-hour format.
 * @param {string} time
 * @returns {boolean}
 */
function isValidTime(time) {
  return /^\d{2}:\d{2}$/.test(time);
}

/**
 * Compare two "HH:MM" strings lexicographically (works for 24h time).
 * @param {string} a
 * @param {string} b
 * @returns {boolean} true if a < b
 */
function timeLessThan(a, b) {
  return a < b;
}

/**
 * Get a professional by ID, including assigned services and working hours.
 * @param {string} id - UUID of the professional.
 * @returns {Promise<Object>} Professional record.
 * @throws {NotFoundError} If no professional with that ID exists.
 */
export async function getProfessionalById(id) {
  const professional = await prisma.professional.findUnique({
    where: { id },
    include: {
      services: {
        include: { service: true },
      },
      workingHours: {
        orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
      },
    },
  });

  if (!professional) {
    throw new NotFoundError('Professional not found', 'PROFESSIONAL_NOT_FOUND');
  }

  return professional;
}

/**
 * Create a new professional.
 * @param {{ name: string, email?: string, phone?: string }} data
 * @returns {Promise<Object>} Created professional record.
 */
export async function createProfessional({ name, email, phone }) {
  return prisma.professional.create({
    data: {
      name,
      email: email ?? null,
      phone: phone ?? null,
    },
  });
}

/**
 * Update an existing professional.
 * Allowed fields: name, email, phone, active.
 * @param {string} id - UUID of the professional.
 * @param {{ name?: string, email?: string, phone?: string, active?: boolean }} data
 * @returns {Promise<Object>} Updated professional record.
 * @throws {NotFoundError} If no professional with that ID exists.
 */
export async function updateProfessional(id, data) {
  const existing = await prisma.professional.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError('Professional not found', 'PROFESSIONAL_NOT_FOUND');
  }

  const { name, email, phone, active } = data;
  const updateData = {};
  if (name !== undefined) updateData.name = name;
  if (email !== undefined) updateData.email = email;
  if (phone !== undefined) updateData.phone = phone;
  if (active !== undefined) updateData.active = active;

  return prisma.professional.update({ where: { id }, data: updateData });
}

/**
 * Assign a service to a professional.
 * Throws if either the professional or service doesn't exist.
 * Prisma P2002 (duplicate assignment) is handled by errorHandler → 409.
 * @param {string} professionalId
 * @param {string} serviceId
 * @returns {Promise<Object>} Created ProfessionalService record.
 * @throws {NotFoundError} If professional or service not found.
 */
export async function assignService(professionalId, serviceId) {
  const professional = await prisma.professional.findUnique({ where: { id: professionalId } });
  if (!professional) {
    throw new NotFoundError('Professional not found', 'PROFESSIONAL_NOT_FOUND');
  }

  const service = await prisma.service.findUnique({ where: { id: serviceId } });
  if (!service) {
    throw new NotFoundError('Service not found', 'SERVICE_NOT_FOUND');
  }

  return prisma.professionalService.create({
    data: { professionalId, serviceId },
    include: { service: true },
  });
}

/**
 * Remove a service assignment from a professional.
 * @param {string} professionalId
 * @param {string} serviceId
 * @returns {Promise<Object>} Deleted ProfessionalService record.
 * @throws {NotFoundError} If the assignment does not exist.
 */
export async function removeService(professionalId, serviceId) {
  const assignment = await prisma.professionalService.findUnique({
    where: {
      professionalId_serviceId: { professionalId, serviceId },
    },
  });

  if (!assignment) {
    throw new NotFoundError('Service assignment not found', 'ASSIGNMENT_NOT_FOUND');
  }

  return prisma.professionalService.delete({
    where: {
      professionalId_serviceId: { professionalId, serviceId },
    },
  });
}

/**
 * Replace the working hours schedule for a professional.
 * This is a full replacement: existing hours are deleted, new ones are created.
 *
 * @param {string} professionalId
 * @param {Array<{ dayOfWeek: number, startTime: string, endTime: string }>} hours
 * @returns {Promise<{ professionalId: string, hours: Array }>}
 * @throws {NotFoundError} If professional not found.
 * @throws {ValidationError} If hours data is invalid.
 */
export async function replaceWorkingHours(professionalId, hours) {
  const professional = await prisma.professional.findUnique({ where: { id: professionalId } });
  if (!professional) {
    throw new NotFoundError('Professional not found', 'PROFESSIONAL_NOT_FOUND');
  }

  // Validate each entry before transacting
  const errors = {};
  hours.forEach((h, i) => {
    const entryErrors = [];

    if (!Number.isInteger(h.dayOfWeek) || h.dayOfWeek < 0 || h.dayOfWeek > 6) {
      entryErrors.push('dayOfWeek must be an integer between 0 and 6');
    }

    if (!isValidTime(h.startTime)) {
      entryErrors.push('startTime must match HH:MM format');
    }

    if (!isValidTime(h.endTime)) {
      entryErrors.push('endTime must match HH:MM format');
    }

    if (
      isValidTime(h.startTime) &&
      isValidTime(h.endTime) &&
      !timeLessThan(h.startTime, h.endTime)
    ) {
      entryErrors.push('startTime must be before endTime');
    }

    if (entryErrors.length > 0) {
      errors[`hours[${i}]`] = entryErrors;
    }
  });

  if (Object.keys(errors).length > 0) {
    throw new ValidationError('Invalid working hours data', errors);
  }

  // Full replace inside a transaction
  const updatedHours = await prisma.$transaction(async (tx) => {
    await tx.workingHours.deleteMany({ where: { professionalId } });

    if (hours.length > 0) {
      await tx.workingHours.createMany({
        data: hours.map((h) => ({
          professionalId,
          dayOfWeek: h.dayOfWeek,
          startTime: h.startTime,
          endTime: h.endTime,
        })),
      });
    }

    return tx.workingHours.findMany({
      where: { professionalId },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
  });

  return { professionalId, hours: updatedHours };
}
