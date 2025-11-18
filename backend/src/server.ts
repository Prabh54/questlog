import { createApp } from './app';
import { env } from './config/env';
import { prisma } from './db/prisma';

async function main() {
  const app = createApp();

  await prisma.$connect();
  console.info(`✅  Database connected`);

  const server = app.listen(env.PORT, () => {
    console.info(`🚀  Server running on http://localhost:${env.PORT} [${env.NODE_ENV}]`);
  });

  const shutdown = async (signal: string) => {
    console.info(`\n${signal} received — shutting down gracefully`);
    server.close(async () => {
      await prisma.$disconnect();
      console.info('Server closed');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  console.error('Fatal error during startup:', err);
  process.exit(1);
});
