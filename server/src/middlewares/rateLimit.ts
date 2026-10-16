import rateLimit, { type Options } from 'express-rate-limit';
import { env, isTest } from '../config/env.js';

const passthrough: Options['skip'] = () => isTest;

/** Limita tentativas de login por IP e por e-mail. */
export const loginLimiter = rateLimit({
  windowMs: env.LOGIN_WINDOW_MINUTES * 60 * 1000,
  limit: env.RATE_LIMIT_LOGIN_MAX,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: passthrough,
  message: {
    error: {
      code: 'too_many_requests',
      message: 'Muitas tentativas de login. Aguarde alguns minutos e tente novamente.',
    },
  },
});

/** Limita o volume de tráfego dos endpoints públicos de resposta. */
export const publicLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: env.RATE_LIMIT_PUBLIC_MAX,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: passthrough,
  message: {
    error: {
      code: 'too_many_requests',
      message: 'Muitas requisições. Aguarde um instante e continue.',
    },
  },
});

/** Limite mais rígido para a criação de submissões. */
export const submissionLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: Math.max(10, Math.round(env.RATE_LIMIT_PUBLIC_MAX / 4)),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: passthrough,
  message: {
    error: {
      code: 'too_many_requests',
      message: 'Muitas submissões em pouco tempo. Aguarde um instante.',
    },
  },
});

/** Limita requisições administrativas por sessão/IP. */
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 600,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: passthrough,
  message: {
    error: {
      code: 'too_many_requests',
      message: 'Muitas requisições administrativas. Aguarde um instante.',
    },
  },
});