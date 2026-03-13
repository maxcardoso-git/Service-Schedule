import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';

import healthRouter from './routes/health.js';
import adminAuthRouter from './routes/admin/auth.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

// Security headers
app.use(helmet());

// Cross-origin resource sharing
app.use(cors());

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

// Domain routes will be mounted in Plans 03/04

// Global error handler — MUST be last middleware
app.use(errorHandler);

export default app;
