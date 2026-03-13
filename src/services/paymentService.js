import { v4 as uuidv4 } from 'uuid';
import prisma from '../lib/prisma.js';
import { NotFoundError, ValidationError, ConflictError } from '../lib/errors.js';

function generatePixPayload(bookingId, amount) {
  const txid = uuidv4().replace(/-/g, '').toUpperCase();
  return `PIX-SIM:txid=${txid}:booking=${bookingId}:amount=${amount}`;
}

export async function createPixIntent(bookingId) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { services: true, payment: true },
  });

  if (!booking) {
    throw new NotFoundError('Booking not found', 'BOOKING_NOT_FOUND');
  }

  if (booking.status !== 'CONFIRMED') {
    throw new ValidationError(
      'Payment intent can only be created for CONFIRMED bookings',
      null,
      'BOOKING_NOT_CONFIRMED'
    );
  }

  if (booking.payment) {
    throw new ConflictError('Payment already exists for this booking', 'PAYMENT_ALREADY_EXISTS');
  }

  const total = booking.services.reduce((sum, bs) => sum + parseFloat(bs.price), 0);
  const amount = Number(total).toFixed(2);
  const pixPayload = generatePixPayload(bookingId, amount);

  try {
    const payment = await prisma.payment.create({
      data: { bookingId, amount, status: 'PENDING', pixPayload },
    });
    return payment;
  } catch (err) {
    if (err.code === 'P2002') {
      throw new ConflictError('Payment already exists for this booking', 'PAYMENT_ALREADY_EXISTS');
    }
    throw err;
  }
}

export async function getPaymentStatus(paymentId) {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
  });

  if (!payment) {
    throw new NotFoundError('Payment not found', 'PAYMENT_NOT_FOUND');
  }

  return payment;
}

export async function simulatePaid(paymentId) {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
  });

  if (!payment) {
    throw new NotFoundError('Payment not found', 'PAYMENT_NOT_FOUND');
  }

  if (payment.status !== 'PENDING') {
    throw new ConflictError(
      `Cannot simulate payment in status ${payment.status}`,
      'INVALID_STATUS_TRANSITION'
    );
  }

  const updated = await prisma.payment.update({
    where: { id: paymentId },
    data: { status: 'PAID' },
  });

  return updated;
}
