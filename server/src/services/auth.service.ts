import bcrypt from 'bcryptjs';
import { prisma } from '../utils/prisma.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';
import { generateToken, hashIp, hashToken } from '../utils/crypto.js';
import type { Request, Response } from 'express';

const BCRYPT_ROUNDS = 12;
const MAX_ATTEMPTS_PER_EMAIL = env.RATE_LIMIT_LOGIN_MAX;
const ATTEMPT_WINDOW_MS = env.LOGIN_WINDOW_MINUTES * 60 * 1000;

export type AuthUser = {
  id: string;
  name: string;
  email: string;
};

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}

export async function countRecentFailedAttempts(email: string, ip?: string): Promise<number> {
  const since = new Date(Date.now() - ATTEMPT_WINDOW_MS);
  const [byEmail, byIp] = await Promise.all([
    prisma.loginAttempt.count({
      where: { email: email.toLowerCase(), successful: false, createdAt: { gte: since } },
    }),
    ip
      ? prisma.loginAttempt.count({
          where: { ipHash: hashIp(ip), successful: false, createdAt: { gte: since } },
        })
      : Promise.resolve(0),
  ]);
  return Math.max(byEmail, byIp);
}

export async function registerLoginAttempt(email: string, successful: boolean, ip?: string) {
  await prisma.loginAttempt.create({
    data: { email: email.toLowerCase().slice(0, 180), successful, ipHash: ip ? hashIp(ip) : null },
  });
  // Limpeza opportunística: nada além da janela de análise é necessário.
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  await prisma.loginAttempt.deleteMany({ where: { createdAt: { lt: cutoff } } });
}

/** Cria a sessão, devolve o token bruto (única vez em que ele trafega) e expira. */
export async function createSession(
  userId: string,
  res: Response,
): Promise<{ token: string; expiresAt: Date }> {
  const token = generateToken(32);
  const expiresAt = new Date(Date.now() + env.SESSION_TTL_SECONDS * 1000);

  await prisma.session.create({
    data: { tokenHash: hashToken(token), userId, expiresAt },
  });

  setSessionCookie(res, token, expiresAt);
  return { token, expiresAt };
}

export function setSessionCookie(res: Response, token: string, expiresAt: Date): void {
  res.cookie(env.SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAME_SITE,
    path: '/',
    expires: expiresAt,
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(env.SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAME_SITE,
    path: '/',
  });
}

export async function destroySessionFromRequest(req: Request, res: Response): Promise<void> {
  const token = req.cookies?.[env.SESSION_COOKIE_NAME];
  if (typeof token === 'string' && token.length > 0) {
    await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  }
  clearSessionCookie(res);
}

export async function resolveSession(token: string | undefined): Promise<AuthUser | null> {
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  if (!session) return null;

  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }

  return session.user;
}

export async function logoutAllSessions(userId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { userId } });
}

export async function pruneExpiredSessions(): Promise<void> {
  await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
}

/** Requer uma sessão administrativa válida. */
export function assertAuthenticated(user: AuthUser | null): AuthUser {
  if (!user) throw AppError.unauthorized();
  return user;
}

export type AuthUserFromRequest = AuthUser | null;