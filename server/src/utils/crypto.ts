import crypto from 'node:crypto';
import { env } from '../config/env.js';

/** Gera um token opaco e criptograficamente seguro (32 bytes). */
export function generateToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('base64url');
}

/**
 * O banco armazena apenas o hash do token de sessão; o cookie httpOnly leva
 * o token em claro. Um vazamento do banco não permite forjar sessões.
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(`${token}${env.APP_SECRET}`).digest('hex');
}

/**
 * Pseudonimiza um endereço IP para logs de segurança, evitando armazenar
 * dados pessoais desnecessários (o IP nunca é salvo junto das respostas).
 */
export function hashIp(ip: string): string {
  return crypto.createHash('sha256').update(`${ip}${env.APP_SECRET}`).digest('hex');
}

/** Comparação de tempo constante. */
export function safeEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) return false;
  return crypto.timingSafeEqual(bufferA, bufferB);
}

/** Chave de idempotência validada antes de chegar ao banco. */
export function isValidIdempotencyKey(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{16,80}$/.test(value);
}