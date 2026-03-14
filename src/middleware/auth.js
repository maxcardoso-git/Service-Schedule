import jwt from 'jsonwebtoken';
import { UnauthorizedError, ForbiddenError } from '../lib/errors.js';

/**
 * API key authentication middleware for agent requests.
 * Reads x-api-key header and compares against process.env.API_KEY.
 */
export function apiKeyAuth(req, res, next) {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey || apiKey !== process.env.API_KEY) {
    throw new UnauthorizedError('Invalid or missing API key', 'INVALID_API_KEY');
  }

  next();
}

/**
 * JWT authentication middleware for admin routes.
 * Reads Authorization header (Bearer <token>), verifies JWT,
 * and attaches decoded payload to req.admin.
 */
export function adminAuth(req, res, next) {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new UnauthorizedError('Invalid or expired token', 'INVALID_TOKEN');
  }

  const token = authHeader.slice(7);

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.admin = decoded;
    next();
  } catch {
    throw new UnauthorizedError('Invalid or expired token', 'INVALID_TOKEN');
  }
}

/**
 * Role-based authorization middleware for admin routes.
 * Must be used after adminAuth (requires req.admin to be set).
 * @param {...string} roles - Allowed roles (e.g. 'ADMIN', 'RECEPTIONIST')
 */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.admin || !roles.includes(req.admin.role)) {
      throw new ForbiddenError('Insufficient permissions', 'FORBIDDEN');
    }
    next();
  };
}
