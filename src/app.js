import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';

import healthRouter from './routes/health.js';
import adminAuthRouter from './routes/admin/auth.js';
import clientRouter from './routes/clients.js';
import servicesRouter from './routes/services.js';
import adminServicesRouter from './routes/admin/services.js';
import adminProfessionalsRouter from './routes/admin/professionals.js';
import adminUsersRouter from './routes/admin/users.js';
import adminClientsRouter from './routes/admin/clients.js';
import adminBookingsRouter from './routes/admin/bookings.js';
import adminDashboardRouter from './routes/admin/dashboard.js';
import bookingsRouter from './routes/bookings.js';
import paymentsRouter from './routes/payments.js';
import { errorHandler } from './middleware/errorHandler.js';
import { swaggerSpec, serve, setup } from './swagger.js';

const app = express();

// Security headers
app.use(helmet());

// Cross-origin resource sharing
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? false  // same-origin in production, no CORS needed
    : ['http://localhost:5173'],
  credentials: true,
}));

// JSON body parsing (1mb limit)
app.use(express.json({ limit: '1mb' }));

// Default rate limiting: 100 requests per 15 minutes
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// Health check — NOT behind API key auth
app.use('/api/health', healthRouter);

// Admin auth — NOT behind API key auth (it IS the auth mechanism)
app.use('/api/admin/auth', adminAuthRouter);

// Client identity routes — CLNT-01, CLNT-02, CLNT-03
app.use('/api/clients', clientRouter);

// Services catalog — SRVC-01 (public listing)
app.use('/api/services', servicesRouter);

// Admin services — SRVC-02 (CRUD)
app.use('/api/admin/services', adminServicesRouter);

// Admin professionals — SRVC-03, SRVC-04 (profiles, assignments, working hours)
app.use('/api/admin/professionals', adminProfessionalsRouter);

// Admin user management — requires ADMIN role
app.use('/api/admin/users', adminUsersRouter);

// Admin client listing
app.use('/api/admin/clients', adminClientsRouter);

// Admin booking status updates
app.use('/api/admin/bookings', adminBookingsRouter);

// Admin dashboard stats
app.use('/api/admin/dashboard', adminDashboardRouter);

// Booking scheduling — SCHD-01 through SCHD-08
app.use('/api/bookings', bookingsRouter);

// Payment engine — PYMT-01 through PYMT-03
app.use('/api/payments', paymentsRouter);

// Swagger API documentation — NOT behind API key auth
app.use('/api-docs', serve, setup(swaggerSpec));

// Global error handler — MUST be last middleware
app.use(errorHandler);

export default app;
