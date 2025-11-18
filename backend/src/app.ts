import express from 'express';
import cors from 'cors';
import { env } from './config/env';
import authRouter from './routes/auth.routes';
import categoriesRouter from './routes/categories.routes';
import questsRouter from './routes/quests.routes';
import entriesRouter from './routes/entries.routes';
import dashboardRouter from './routes/dashboard.routes';
import analyticsRouter from './routes/analytics.routes';
import { errorMiddleware } from './middleware/error.middleware';

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

  app.use('/auth', authRouter);
  app.use('/categories', categoriesRouter);
  app.use('/quests', questsRouter);
  app.use('/entries', entriesRouter);
  app.use('/dashboard', dashboardRouter);
  app.use('/analytics', analyticsRouter);

  // Must be last — catches errors forwarded via next(err)
  app.use(errorMiddleware);

  return app;
}
