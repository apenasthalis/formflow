import { z } from 'zod';

/**
 * Validação e leitura das variáveis de ambiente.
 * A aplicação falha na inicialização se alguma variável obrigatória faltar,
 * evitando subir em um estado parcialmente configurado.
 */
const booleanish = z
  .string()
  .transform((value) => ['1', 'true', 'yes', 'on'].includes(value.toLowerCase()));

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL é obrigatória'),

  /** Origem autorizada para chamadas CORS (o frontend, via Nginx). */
  CORS_ORIGIN: z.string().default('http://localhost'),

  SESSION_COOKIE_NAME: z.string().default('ff_session'),
  /** Duração da sessão administrativa em segundos. */
  SESSION_TTL_SECONDS: z.coerce.number().int().positive().default(60 * 60 * 12),

  /** Segredo usado para assinar cookies e derivar hashes de tokens/IPs. */
  APP_SECRET: z
    .string()
    .min(16, 'APP_SECRET deve ter ao menos 16 caracteres')
    .default('dev-only-insecure-secret-change-me'),

  COOKIE_SECURE: booleanish.default('false'),
  COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'),

  /** Limites dos rate limiters. */
  RATE_LIMIT_LOGIN_MAX: z.coerce.number().int().positive().default(10),
  RATE_LIMIT_PUBLIC_MAX: z.coerce.number().int().positive().default(120),
  LOGIN_WINDOW_MINUTES: z.coerce.number().int().positive().default(15),

  /** Trust proxy (Nginx no Docker): 1 = somente o proxy imediato. */
  TRUST_PROXY: z.coerce.number().int().min(0).max(3).default(1),

  /** Base URL pública usada nos links compartilháveis. */
  PUBLIC_APP_URL: z.string().default('http://localhost'),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues.map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`);
  // eslint-disable-next-line no-console
  console.error(`Configuração de ambiente inválida:\n${details.join('\n')}`);
  process.exit(1);
}

export const env = parsed.data;
export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';