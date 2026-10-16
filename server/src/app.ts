import express, { type Express } from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env, isProduction, isTest } from './config/env.js';
import { attachUser } from './middlewares/auth.js';
import { authRouter } from './routes/auth.routes.js';
import { formsRouter, questionsRouter } from './routes/forms.routes.js';
import { publicRouter } from './routes/public.routes.js';
import { errorHandler, notFoundHandler } from './utils/errors.js';
import { prisma } from './utils/prisma.js';

export function createApp(): Express {
  const app = express();

  // O Nginx local é o proxy imediato; confiar em 1 nível evita forjar X-Forwarded-For.
  app.set('trust proxy', env.TRUST_PROXY);
  app.disable('x-powered-by');

  app.use(
    helmet({
      // O frontend é servido em outra origem (mesmo host, porta diferente em dev).
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  app.use(
    cors({
      origin: env.CORS_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean),
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type'],
    }),
  );

  app.use(express.json({ limit: '256kb' }));
  app.use(express.urlencoded({ extended: false, limit: '256kb' }));
  app.use(cookieParser());
  app.use(attachUser);

  if (!isTest) {
    app.use(morgan(isProduction ? 'combined' : 'dev'));
  }

  app.get('/api/health', async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ status: 'ok', database: 'up', timestamp: new Date().toISOString() });
    } catch {
      res.status(503).json({ status: 'degraded', database: 'down' });
    }
  });

  app.use('/api/auth', authRouter);
  app.use('/api/forms', formsRouter);
  app.use('/api/questions', questionsRouter);
  app.use('/api/public', publicRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}