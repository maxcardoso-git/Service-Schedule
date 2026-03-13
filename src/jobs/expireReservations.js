import cron from 'node-cron';
import prisma from '../lib/prisma.js';
import logger from '../lib/logger.js';

export function startExpiryJob() {
  cron.schedule('* * * * *', async () => {
    try {
      const result = await prisma.booking.updateMany({
        where: {
          status: 'PRE_RESERVED',
          expiresAt: { lt: new Date() },
        },
        data: { status: 'CANCELLED' },
      });

      if (result.count > 0) {
        logger.info(`Expired ${result.count} pre-reservations`);
      }
    } catch (err) {
      logger.error('Error expiring pre-reservations', { error: err.message });
    }
  });
}
