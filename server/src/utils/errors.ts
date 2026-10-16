import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';

export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }

  static badRequest(message: string, details?: unknown) {
    return new AppError(400, 'bad_request', message, details);
  }

  static unauthorized(message = 'Autenticação necessária.') {
    return new AppError(401, 'unauthorized', message);
  }

  static forbidden(message = 'Você não tem permissão para acessar este recurso.') {
    return new AppError(403, 'forbidden', message);
  }

  static notFound(message = 'Recurso não encontrado.') {
    return new AppError(404, 'not_found', message);
  }

  static conflict(message: string, details?: unknown) {
    return new AppError(409, 'conflict', message, details);
  }

  static tooMany(message = 'Muitas requisições. Tente novamente em instantes.') {
    return new AppError(429, 'too_many_requests', message);
  }
}

type ErrorBody = {
  error: { code: string; message: string; details?: unknown };
};

/** Handler final de erros: normaliza todas as respostas de falha no mesmo formato. */
export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response<ErrorBody>,
  _next: NextFunction,
): void {
  if (error instanceof ZodError) {
    res.status(422).json({
      error: {
        code: 'validation_error',
        message: 'Dados inválidos.',
        details: error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      },
    });
    return;
  }

  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      error: { code: error.code, message: error.message, details: error.details },
    });
    return;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      res.status(409).json({
        error: { code: 'conflict', message: 'Já existe um registro com estes dados.' },
      });
      return;
    }
    if (error.code === 'P2025') {
      res.status(404).json({
        error: { code: 'not_found', message: 'Recurso não encontrado.' },
      });
      return;
    }
  }

  // eslint-disable-next-line no-console
  console.error('[erro não tratado]', error);
  res.status(500).json({
    error: { code: 'internal_error', message: 'Erro interno. Tente novamente mais tarde.' },
  });
}

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({
    error: { code: 'not_found', message: 'Rota não encontrada.' },
  });
}