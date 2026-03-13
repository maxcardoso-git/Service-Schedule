import { AppError } from '../lib/errors.js';
import logger from '../lib/logger.js';

/**
 * Global error handler middleware.
 * Must be registered as the LAST middleware in Express.
 *
 * Handles:
 * - AppError subclasses: returns structured error with statusCode
 * - Prisma P2002 unique constraint: returns 409 CONFLICT
 * - Unknown errors: returns 500 INTERNAL_ERROR (no stack leak in production)
 */
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  // AppError and subclasses (NotFoundError, ValidationError, etc.)
  if (err instanceof AppError) {
    const body = {
      error: {
        code: err.code,
        message: err.message,
      },
    };

    if (err.details !== null && err.details !== undefined) {
      body.error.details = err.details;
    }

    return res.status(err.statusCode).json(body);
  }

  // Prisma known request error — P2002 = unique constraint violation
  if (err.code === 'P2002') {
    return res.status(409).json({
      error: {
        code: 'CONFLICT',
        message: 'Resource already exists',
      },
    });
  }

  // Unknown errors — log internally, never expose details in production
  logger.error('Unhandled error', {
    message: err.message,
    stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
    path: req.path,
    method: req.method,
  });

  return res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
    },
  });
}
