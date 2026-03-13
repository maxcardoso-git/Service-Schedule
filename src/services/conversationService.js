import prisma from '../lib/prisma.js';

/**
 * Creates a ConversationLink row associating a booking with a conversation session.
 * Does NOT catch errors — the caller wraps in try/catch for fire-and-forget behavior.
 *
 * @param {string} bookingId - UUID of the booking
 * @param {string} conversationId - Conversation session identifier
 * @returns {Promise<object>} Created ConversationLink
 */
export async function createConversationLink(bookingId, conversationId) {
  return prisma.conversationLink.create({
    data: { bookingId, conversationId },
  });
}

/**
 * Retrieves all bookings linked to a conversation session.
 *
 * @param {string} conversationId - Conversation session identifier
 * @returns {Promise<object[]>} Array of booking objects with client, services, and professional
 */
export async function getBookingsByConversationId(conversationId) {
  const links = await prisma.conversationLink.findMany({
    where: { conversationId },
    include: {
      booking: {
        include: {
          client: true,
          services: { include: { service: true } },
          professional: true,
        },
      },
    },
  });

  return links.map((l) => l.booking);
}
