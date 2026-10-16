import { PrismaClient } from '@prisma/client';
import { env, isTest } from '../config/env.js';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (!isTest) {
  globalForPrisma.prisma = prisma;
}

/**
 * Aguarda o PostgreSQL ficar disponível. Usado pelo entrypoint do container
 * para que migrações e o servidor só iniciem depois do banco estar pronto.
 */
export async function waitForDatabase({
  attempts = 30,
  delayMs = 2000,
}: { attempts?: number; delayMs?: number } = {}): Promise<void> {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return;
    } catch (error) {
      if (attempt === attempts) throw error;
      // eslint-disable-next-line no-console
      console.log(`[db] aguardando PostgreSQL (tentativa ${attempt}/${attempts})...`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}