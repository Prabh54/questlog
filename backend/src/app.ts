import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env';
import authRouter from './routes/auth.routes';
import categoriesRouter from './routes/categories.routes';
import questsRouter from './routes/quests.routes';
import entriesRouter from './routes/entries.routes';
import dashboardRouter from './routes/dashboard.routes';
import analyticsRouter from './routes/analytics.routes';
import { errorMiddleware } from './middleware/error.middleware';
import { buildOpenApiDocument } from './openapi/spec';

/** Mount table — also read by the OpenAPI coverage test. */
export const apiRouters = {
  '/auth': authRouter,
  '/categories': categoriesRouter,
  '/quests': questsRouter,
  '/entries': entriesRouter,
  '/dashboard': dashboardRouter,
  '/analytics': analyticsRouter,
} as const;

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true,
    }),
  );

  app.use(express.json());
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

  for (const [prefix, router] of Object.entries(apiRouters)) {
    app.use(prefix, router);
  }

  // Must be last — catches errors forwarded via next(err)
  app.use(errorMiddleware);

  return app;
}
