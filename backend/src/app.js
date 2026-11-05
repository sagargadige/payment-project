import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import env from './config/env.js';
import paypalConfig from './config/paypal.js';
import { apiLimiter } from './middleware/rateLimit.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';

import authRoutes from './routes/authRoutes.js';
import courseRoutes from './routes/courseRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import webhookRoutes from './routes/webhookRoutes.js';

export function createApp() {
  const app = express();

  // Behind a proxy (Heroku/Render/Nginx) so rate-limit + secure cookies work.
  app.set('trust proxy', 1);

  // --- Security headers ---
  app.use(helmet());

  // --- CORS: only the configured frontend origin(s) ---
  app.use(
    cors({
      origin(origin, cb) {
        if (!origin || env.clientOrigins.includes(origin)) return cb(null, true);
        return cb(new Error(`CORS blocked for origin ${origin}`));
      },
      credentials: true,
    }),
  );

  // --- Logging ---
  app.use(morgan(env.isProduction ? 'combined' : 'dev'));

  // --- Webhooks FIRST (raw body) — must be before express.json() ---
  app.use('/api/payments/webhook', webhookRoutes);

  // --- JSON body parser for everything else ---
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  // --- Rate limiting on the API ---
  app.use('/api', apiLimiter);

  // --- Health check ---
  app.get('/api/health', (_req, res) => {
    res.json({
      success: true,
      data: {
        status: 'ok',
        paypalMode: paypalConfig.mode,
        receivingAccount: paypalConfig.receivingAccount || null,
        time: new Date().toISOString(),
      },
    });
  });

  // --- Public config for the frontend (client id is safe to expose) ---
  app.get('/api/config', (_req, res) => {
    res.json({
      success: true,
      data: {
        paypalClientId: paypalConfig.publicClientId,
        paypalMode: paypalConfig.mode,
        currency: 'USD',
      },
    });
  });

  // --- Routes ---
  app.use('/api/auth', authRoutes);
  app.use('/api/courses', courseRoutes);
  app.use('/api/payments', paymentRoutes);
  app.use('/api/orders', orderRoutes);
  app.use('/api/admin', adminRoutes);

  // --- 404 + central error handler (must be last) ---
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export default createApp;
