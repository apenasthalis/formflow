import type { Request } from 'express';
import { AppError } from './errors.js';

/** Lê um parâmetro de rota obrigatório com tipo correto. */
export function routeParam(req: Request, name: string): string {
  const value = req.params[name];
  if (typeof value !== 'string' || value.length === 0) {
    throw AppError.badRequest(`Parâmetro "${name}" ausente.`);
  }
  return value;
}

/** Lê um parâmetro de rota que deve ser um UUID. */
export function routeId(req: Request, name = 'id'): string {
  const value = routeParam(req, name);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    throw AppError.notFound('Recurso não encontrado.');
  }
  return value;
}