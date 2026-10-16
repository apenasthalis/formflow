import { createApp } from './app.js';
import { env } from './config/env.js';
import { prisma, waitForDatabase } from './utils/prisma.js';
import { pruneExpiredSessions } from './services/auth.service.js';

async function bootstrap(): Promise<void> {
  await waitForDatabase();

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`[api] FormFlow ouvindo em http://0.0.0.0:${env.PORT} (${env.NODE_ENV})`);
  });

  const cleanupInterval = setInterval(() => {
    void pruneExpiredSessions().catch(() => undefined);
  }, 60 * 60 * 1000);
  cleanupInterval.unref();

  const shutdown = async (signal: string) => {
    // eslint-disable-next-line no-console
    console.log(`[api] ${signal} recebido, encerrando...`);
    clearInterval(cleanupInterval);
    server.close(async () => {
      await prisma.$disconnect().catch(() => undefined);
      process.exit(0);
    });
    // Rede de segurança caso algum socket fique preso.
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

bootstrap().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('[api] falha ao iniciar:', error);
  process.exit(1);
});