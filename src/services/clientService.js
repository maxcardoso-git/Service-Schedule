import prisma from '../lib/prisma.js';
import { NotFoundError } from '../lib/errors.js';

/**
 * Normalize a phone number: strip all non-digit characters.
 * @param {string} phone
 * @returns {string}
 */
function normalizePhone(phone) {
  return phone.replace(/\D/g, '').trim();
}

/**
 * Find a client by phone number.
 * @param {string} phone - Raw phone string (will be normalized).
 * @returns {Promise<Object>} Client record.
 * @throws {NotFoundError} If no client with that phone exists.
 */
export async function findClientByPhone(phone) {
  const normalized = normalizePhone(phone);

  const client = await prisma.client.findUnique({
    where: { phone: normalized },
  });

  if (!client) {
    throw new NotFoundError('Client not found', 'CLIENT_NOT_FOUND');
  }

  return client;
}

/**
 * Create a new client.
 * @param {{ name: string, phone: string, email?: string }} data
 * @returns {Promise<Object>} Created client record.
 * @throws Prisma P2002 on duplicate phone (bubbles to errorHandler → 409 CONFLICT).
 */
export async function createClient({ name, phone, email }) {
  const normalized = normalizePhone(phone);

  const client = await prisma.client.create({
    data: {
      name,
      phone: normalized,
      email: email ?? null,
    },
  });

  return client;
}

/**
 * List clients with optional search and pagination.
 * @param {{ search?: string, page?: number, limit?: number }} params
 * @returns {Promise<{ clients: Array, total: number, page: number, limit: number }>}
 */
export async function listClients({ search, page = 1, limit = 20 } = {}) {
  const where = search
    ? {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search, mode: 'insensitive' } },
        ],
      }
    : {};

  const skip = (page - 1) * limit;

  const [clients, total] = await Promise.all([
    prisma.client.findMany({
      where,
      skip,
      take: limit,
      orderBy: { name: 'asc' },
    }),
    prisma.client.count({ where }),
  ]);

  return { clients, total, page, limit };
}

/**
 * Get all bookings for a client, ordered by start time descending.
 * @param {string} clientId - UUID of the client.
 * @returns {Promise<Array>} Array of booking records (may be empty).
 * @throws {NotFoundError} If client does not exist.
 */
export async function getClientAppointments(clientId) {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
  });

  if (!client) {
    throw new NotFoundError('Client not found', 'CLIENT_NOT_FOUND');
  }

  const appointments = await prisma.booking.findMany({
    where: { clientId },
    include: {
      services: {
        include: { service: true },
      },
      professional: true,
    },
    orderBy: { startTime: 'desc' },
  });

  return appointments;
}
