import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env';
import { createAuthRouter } from './routes/auth.routes';
import categoriesRouter from './routes/categories.routes';
import questsRouter from './routes/quests.routes';
import entriesRouter from './routes/entries.routes';
import dashboardRouter from './routes/dashboard.routes';
import analyticsRouter from './routes/analytics.routes';
import { errorMiddleware } from './middleware/error.middleware';
import { createAuthRateLimiters } from './middleware/rate-limit.middleware';
import { buildOpenApiDocument } from './openapi/spec';

export interface AppOptions {
  /** Auth rate limits; on by default, off in tests unless a test opts in. */
  rateLimit?: boolean;
}

/** Mount table — also read by the OpenAPI coverage test. */
export function buildApiRouters({ rateLimit = env.NODE_ENV !== 'test' }: AppOptions = {}) {
  return {
    '/auth': createAuthRouter(createAuthRateLimiters(rateLimit)),
    '/categories': categoriesRouter,
    '/quests': questsRouter,
    '/entries': entriesRouter,
    '/dashboard': dashboardRouter,
    '/analytics': analyticsRouter,
  };
}

export function createApp(options: AppOptions = {}) {
  const app = express();
  // Security headers (HSTS, nosniff, frame-ancestors, CSP, …)
  app.use(helmet());

  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true,
    }),
  );

  app.use(express.json({ limit: '16kb' }));
  app.use(cookieParser());
  app.use(express.urlencoded({ extended: true }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', env: env.NODE_ENV, timestamp: new Date().toISOString() });
  });

  // API reference, generated from the shared Zod schemas
  const openApiDocument = buildOpenApiDocument();
  app.get('/openapi.json', (_req, res) => {
    res.json(openApiDocument);
  });
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiDocument, { customSiteTitle: 'QuestLog API' }));

  for (const [prefix, router] of Object.entries(buildApiRouters(options))) {
    app.use(prefix, router);
  }

  // Must be last — catches errors forwarded via next(err)
  app.use(errorMiddleware);

  return app;
}
