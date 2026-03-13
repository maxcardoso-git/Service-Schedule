import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';

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

// Routes will be mounted in Plan 02

export default app;
