import 'dotenv/config';
import app from './app.js';
import logger from './lib/logger.js';
import { startExpiryJob } from './jobs/expireReservations.js';

const PORT = process.env.PORT || 3100;

const server = app.listen(PORT, () => {
  logger.info('Server running', { port: PORT });
  startExpiryJob();
  logger.info('Expiry sweep job started');
});

const shutdown = (signal) => {
  logger.info(`${signal} received, shutting down gracefully`);
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
