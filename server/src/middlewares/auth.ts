import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';
import { resolveSession, type AuthUser } from '../services/auth.service.js';
import { prisma } from '../utils/prisma.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser | null;
    }
  }
}

/** Popula req.user quando houver sessão válida (não bloqueia rotas públicas). */
export async function attachUser(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const token = req.cookies?.[env.SESSION_COOKIE_NAME];
    req.user = await resolveSession(typeof token === 'string' ? token : undefined);
    next();
  } catch (error) {
    next(error);
  }
}

/** Exige sessão administrativa válida. */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    next(AppError.unauthorized('Você precisa entrar no painel administrativo.'));
    return;
  }
  next();
}

/** Carrega o formulário garantindo que pertence ao usuário da sessão. */
export async function requireOwnedForm(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const user = req.user;
    if (!user) {
      next(AppError.unauthorized());
      return;
    }

    const form = await prisma.form.findFirst({
      where: { id: req.params.id ?? '', ownerId: user.id },
      select: { id: true, ownerId: true },
    });

    if (!form) {
      // Mesma resposta para "não existe" e "não é seu": não confirma a existência
      // de formulários de outros administradores.
      next(AppError.notFound('Formulário não encontrado.'));
      return;
    }

    next();
  } catch (error) {
    next(error);
  }
}