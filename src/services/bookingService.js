import { addMinutes } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

import prisma from '../lib/prisma.js';
import { generateAvailableSlots, localTimeToUTC } from '../lib/slots.js';
import { NotFoundError, ValidationError, ConflictError } from '../lib/errors.js';
import { createConversationLink } from './conversationService.js';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function getSalonTimezone() {
  return process.env.SALON_TIMEZONE || 'America/Sao_Paulo';
}

/**
 * Resolve the ISO day-of-week (0=Sun … 6=Sat) for a "YYYY-MM-DD" date string
 * interpreted in the salon's local timezone.
 */
function localDayOfWeek(dateStr, timezone) {
  // Build a UTC midnight Date from the date string, then shift it to local time
  // so that .getDay() returns the correct local calendar day.
  const utcMidnight = new Date(`${dateStr}T00:00:00Z`);
  const localDate = toZonedTime(utcMidnight, timezone);
  return localDate.getDay(); // 0=Sun, 1=Mon, … 6=Sat
}

// ---------------------------------------------------------------------------
// 1. getAvailableSlots
// ---------------------------------------------------------------------------

/**
 * Returns available booking slots for a professional/service/date combination.
 *
 * @param {string} professionalId - UUID
 * @param {string} serviceId      - UUID
 * @param {string} dateStr        - "YYYY-MM-DD" in salon local timezone
 * @returns {{ available: boolean, reason: string|null, slots: string[], nextAvailable: string|null }}
 */
export async function getAvailableSlots(professionalId, serviceId, dateStr) {
  const SALON_TZ = getSalonTimezone();
  const dayOfWeek = localDayOfWeek(dateStr, SALON_TZ);

  // Fetch professional with working hours for that day and assigned service
  const professional = await prisma.professional.findFirst({
    where: {
      id: professionalId,
      active: true,
    },
    include: {
      workingHours: {
        where: { dayOfWeek },
      },
      services: {
        where: { serviceId },
      },
    },
  });

  if (!professional) {
    throw new NotFoundError('Professional not found', 'PROFESSIONAL_NOT_FOUND');
  }

  if (professional.workingHours.length === 0) {
    return { available: false, reason: 'NOT_WORKING', slots: [], nextAvailable: null };
  }

  if (professional.services.length === 0) {
    throw new ValidationError('Professional does not offer this service', null, 'SERVICE_NOT_OFFERED');
  }

  // Fetch service (must exist and be active)
  const service = await prisma.service.findFirst({
    where: { id: serviceId, active: true },
  });

  if (!service) {
    throw new NotFoundError('Service not found', 'SERVICE_NOT_FOUND');
  }

  // Build working hours window in UTC
  const wh = professional.workingHours[0];
  const workStart = localTimeToUTC(wh.startTime, dateStr, SALON_TZ);
  const workEnd = localTimeToUTC(wh.endTime, dateStr, SALON_TZ);

  // Fetch active bookings for this professional in this window, respecting TTL
  const activeBookings = await prisma.$queryRaw`
    SELECT "startTime", "endTime"
    FROM bookings
    WHERE "professionalId" = ${professionalId}::uuid
      AND "startTime" >= ${workStart}
      AND "startTime" < ${workEnd}
      AND status IN ('PRE_RESERVED', 'CONFIRMED')
      AND (
        status = 'CONFIRMED'
        OR (status = 'PRE_RESERVED' AND "expiresAt" > NOW())
      )
    ORDER BY "startTime" ASC
  `;

  const slots = generateAvailableSlots(workStart, workEnd, service.durationMin, activeBookings);

  if (slots.length > 0) {
    return {
      available: true,
      reason: null,
      slots: slots.map((s) => s.toISOString()),
      nextAvailable: null,
    };
  }

  // Slots empty — determine reason
  const reason = activeBookings.length > 0 ? 'FULLY_BOOKED' : 'NOT_WORKING';

  // SCHD-06: search forward up to 14 days for next available date
  let nextAvailable = null;
  for (let offset = 1; offset <= 14; offset++) {
    const nextDate = new Date(`${dateStr}T00:00:00Z`);
    nextDate.setUTCDate(nextDate.getUTCDate() + offset);
    const nextDateStr = nextDate.toISOString().slice(0, 10);
    const nextDow = localDayOfWeek(nextDateStr, SALON_TZ);

    const nextWH = await prisma.workingHours.findFirst({
      where: { professionalId, dayOfWeek: nextDow },
    });

    if (!nextWH) continue;

    const nextWorkStart = localTimeToUTC(nextWH.startTime, nextDateStr, SALON_TZ);
    const nextWorkEnd = localTimeToUTC(nextWH.endTime, nextDateStr, SALON_TZ);

    const nextBookings = await prisma.$queryRaw`
      SELECT "startTime", "endTime"
      FROM bookings
      WHERE "professionalId" = ${professionalId}::uuid
        AND "startTime" >= ${nextWorkStart}
        AND "startTime" < ${nextWorkEnd}
        AND status IN ('PRE_RESERVED', 'CONFIRMED')
        AND (
          status = 'CONFIRMED'
          OR (status = 'PRE_RESERVED' AND "expiresAt" > NOW())
        )
      ORDER BY "startTime" ASC
    `;

    const nextSlots = generateAvailableSlots(nextWorkStart, nextWorkEnd, service.durationMin, nextBookings);
    if (nextSlots.length > 0) {
      nextAvailable = nextDateStr;
      break;
    }
  }

  return { available: false, reason, slots: [], nextAvailable };
}

// ---------------------------------------------------------------------------
// 2. createPreReservation
// ---------------------------------------------------------------------------

/**
 * Creates a 5-minute TTL pre-reservation hold.
 * Idempotent: if idempotencyKey already exists, returns existing booking.
 *
 * @param {{ clientId: string, professionalId: string, serviceId: string, startTime: string, idempotencyKey?: string }} params
 * @returns {Promise<object>} Created or existing booking
 */
export async function createPreReservation({ clientId, professionalId, serviceId, startTime, idempotencyKey, conversationId }) {
  // Idempotency replay: return existing booking if key already used
  if (idempotencyKey) {
    const existing = await prisma.booking.findUnique({
      where: { idempotencyKey },
      include: {
        services: { include: { service: true } },
        professional: true,
        client: true,
      },
    });
    if (existing) return existing;
  }

  // Fetch service to get durationMin and price
  const service = await prisma.service.findFirst({
    where: { id: serviceId, active: true },
  });
  if (!service) {
    throw new NotFoundError('Service not found', 'SERVICE_NOT_FOUND');
  }

  const startDate = new Date(startTime);
  const endTime = addMinutes(startDate, service.durationMin);
  const expiresAt = addMinutes(new Date(), 5);

  try {
    const booking = await prisma.$transaction(async (tx) => {
      return tx.booking.create({
        data: {
          clientId,
          professionalId,
          startTime: startDate,
          endTime,
          status: 'PRE_RESERVED',
          expiresAt,
          idempotencyKey: idempotencyKey ?? null,
          services: {
            create: [{ serviceId, price: service.price }],
          },
        },
        include: {
          services: { include: { service: true } },
          professional: true,
          client: true,
        },
      });
    });

    if (conversationId) {
      try {
        await createConversationLink(booking.id, conversationId);
      } catch (err) {
        console.warn('Failed to create conversation link', { bookingId: booking.id, error: err.message });
      }
    }

    return booking;
  } catch (err) {
    if (err.code === 'P2002') {
      const target = err.meta?.target ?? '';
      const targetStr = Array.isArray(target) ? target.join(',') : String(target);
      if (targetStr.includes('idempotency_key') || targetStr.includes('idempotencyKey')) {
        throw new ConflictError('Duplicate idempotency key', 'IDEMPOTENCY_CONFLICT');
      }
      throw new ConflictError('Time slot is no longer available', 'SLOT_CONFLICT');
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// 3. confirmBooking
// ---------------------------------------------------------------------------

/**
 * Transitions a PRE_RESERVED booking to CONFIRMED using SELECT FOR UPDATE SKIP LOCKED.
 *
 * @param {string} bookingId - UUID
 * @returns {Promise<object>} Confirmed booking
 */
export async function confirmBooking(bookingId) {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw`
      SELECT id, status, "expiresAt"
      FROM bookings
      WHERE id = ${bookingId}::uuid
      FOR UPDATE SKIP LOCKED
    `;

    if (rows.length === 0) {
      throw new ConflictError('Booking is being modified by another request', 'BOOKING_LOCKED');
    }

    const booking = rows[0];

    if (booking.status !== 'PRE_RESERVED') {
      throw new ConflictError(
        `Cannot confirm booking in status ${booking.status}`,
        'INVALID_STATUS_TRANSITION',
      );
    }

    if (booking.expiresAt && new Date(booking.expiresAt) < new Date()) {
      throw new ConflictError('Pre-reservation has expired', 'RESERVATION_EXPIRED');
    }

    return tx.booking.update({
      where: { id: bookingId },
      data: { status: 'CONFIRMED', expiresAt: null },
      include: {
        services: { include: { service: true } },
        professional: true,
        client: true,
      },
    });
  });
}

// ---------------------------------------------------------------------------
// 4. cancelBooking
// ---------------------------------------------------------------------------

/**
 * Transitions a PRE_RESERVED or CONFIRMED booking to CANCELLED.
 *
 * @param {string} bookingId - UUID
 * @returns {Promise<object>} Cancelled booking
 */
export async function cancelBooking(bookingId) {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw`
      SELECT id, status
      FROM bookings
      WHERE id = ${bookingId}::uuid
      FOR UPDATE SKIP LOCKED
    `;

    if (rows.length === 0) {
      throw new ConflictError('Booking is being modified by another request', 'BOOKING_LOCKED');
    }

    const booking = rows[0];

    if (booking.status !== 'PRE_RESERVED' && booking.status !== 'CONFIRMED') {
      throw new ConflictError(
        `Cannot cancel booking in status ${booking.status}`,
        'INVALID_STATUS_TRANSITION',
      );
    }

    return tx.booking.update({
      where: { id: bookingId },
      data: { status: 'CANCELLED' },
      include: {
        services: { include: { service: true } },
        professional: true,
        client: true,
      },
    });
  });
}

// ---------------------------------------------------------------------------
// 5. updateBookingStatus
// ---------------------------------------------------------------------------

/**
 * Update the status of a booking (admin action).
 *
 * @param {string} id - UUID of the booking.
 * @param {string} status - Target status (CONFIRMED, COMPLETED, CANCELLED, NO_SHOW).
 * @returns {Promise<object>} Updated booking with client and service relations.
 * @throws {NotFoundError} If booking does not exist.
 */
export async function updateBookingStatus(id, status) {
  const existing = await prisma.booking.findUnique({ where: { id } });

  if (!existing) {
    throw new NotFoundError('Booking not found', 'BOOKING_NOT_FOUND');
  }

  return prisma.booking.update({
    where: { id },
    data: { status },
    include: {
      client: true,
      services: { include: { service: true } },
    },
  });
}

// ---------------------------------------------------------------------------
// 6. getBookingsByPhone
// ---------------------------------------------------------------------------

/**
 * Returns all bookings for a client identified by phone number.
 *
 * @param {string} phone - Raw phone string (will be normalized)
 * @returns {Promise<object[]>} Array of bookings ordered by startTime desc
 */
export async function getBookingsByPhone(phone) {
  const normalized = phone.replace(/\D/g, '').trim();

  const client = await prisma.client.findUnique({
    where: { phone: normalized },
  });

  if (!client) {
    throw new NotFoundError('Client not found', 'CLIENT_NOT_FOUND');
  }

  const bookings = await prisma.booking.findMany({
    where: { clientId: client.id },
    include: {
      services: { include: { service: true } },
      professional: true,
    },
    orderBy: { startTime: 'desc' },
  });

  return bookings;
}
