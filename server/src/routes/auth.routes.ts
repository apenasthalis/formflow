import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { AppError } from '../utils/errors.js';
import { env } from '../config/env.js';
import { loginLimiter } from '../middlewares/rateLimit.js';
import { requireAuth } from '../middlewares/auth.js';
import {
  countRecentFailedAttempts,
  createSession,
  destroySessionFromRequest,
  logoutAllSessions,
  registerLoginAttempt,
  verifyPassword,
} from '../services/auth.service.js';

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email('Informe um e-mail válido.').max(180),
  password: z.string().min(8, 'A senha deve ter ao menos 8 caracteres.').max(200),
});

export const authRouter = Router();

authRouter.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const { email, password } = credentialsSchema.parse(req.body);
    const ip = req.ip;

    const recentFailures = await countRecentFailedAttempts(email, ip);
    if (recentFailures >= env.RATE_LIMIT_LOGIN_MAX) {
      throw AppError.tooMany('Muitas tentativas de login. Aguarde alguns minutos.');
    }

    const user = await prisma.adminUser.findUnique({ where: { email } });

    // Mensagem genérica: não revela se o e-mail existe.
    const invalid = AppError.unauthorized('E-mail ou senha incorretos.');

    if (!user) {
      await registerLoginAttempt(email, false, ip);
      await new Promise((resolve) => setTimeout(resolve, 250));
      throw invalid;
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      await registerLoginAttempt(email, false, ip);
      throw invalid;
    }

    await registerLoginAttempt(email, true, ip);
    const { expiresAt } = await createSession(user.id, req, res);

    await prisma.adminUser.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    res.json({
      user: { id: user.id, name: user.name, email: user.email },
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

authRouter.post('/logout', async (req, res, next) => {
  try {
    await destroySessionFromRequest(req, res);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

authRouter.post('/logout-all', requireAuth, async (req, res, next) => {
  try {
    await logoutAllSessions(req.user!.id);
    await destroySessionFromRequest(req, res);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

authRouter.get('/me', async (req, res) => {
  if (!req.user) {
    res.status(401).json({ error: { code: 'unauthorized', message: 'Não autenticado.' } });
    return;
  }
  res.json({ user: req.user });
});