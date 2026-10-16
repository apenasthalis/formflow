import type { Express } from 'express';
import request from 'supertest';
import { prisma } from '../src/utils/prisma.js';
import { createApp } from '../src/app.js';
import { hashPassword } from '../src/services/auth.service.js';
import { defaultSettingsFor } from '../src/utils/questions.js';

export const app: Express = createApp();

export const TEST_PASSWORD = 'SenhaDeTeste!2026';

export type TestUser = { id: string; email: string; cookie: string };

/** Cria um administrador isolado para cada suíte de testes. */
export async function createTestUser(prefix: string): Promise<TestUser> {
  const email = `${prefix}-${crypto.randomUUID()}@teste.local`;
  const user = await prisma.adminUser.create({
    data: { name: 'Usuário de Teste', email, passwordHash: await hashPassword(TEST_PASSWORD) },
  });

  const response = await request(app)
    .post('/api/auth/login')
    .send({ email, password: TEST_PASSWORD })
    .expect(200);

  const cookie = (response.headers['set-cookie'] as unknown as string[])[0]?.split(';')[0] ?? '';
  return { id: user.id, email, cookie };
}

export async function destroyTestUser(user: TestUser): Promise<void> {
  // Formulários, versões, submissões e respostas caem em cascata.
  await prisma.adminUser.deleteMany({ where: { id: user.id } });
  await prisma.loginAttempt.deleteMany({ where: { email: user.email } });
}

/** Cliente autenticado com o cookie de sessão anexado. */
export function auth(cookie: string) {
  const agent = (method: 'get' | 'post' | 'patch' | 'delete') => (url: string) =>
    request(app)[method](url).set('Cookie', cookie);

  return {
    get: agent('get'),
    post: agent('post'),
    patch: agent('patch'),
    delete: agent('delete'),
  };
}

export async function createForm(cookie: string, title = 'Formulário de teste') {
  const response = await request(app)
    .post('/api/forms')
    .set('Cookie', cookie)
    .send({ title })
    .expect(201);
  return response.body.form as { id: string; slug: string; status: string };
}

export async function addQuestion(
  cookie: string,
  formId: string,
  overrides: {
    title?: string;
    type?: Parameters<typeof defaultSettingsFor>[0];
    required?: boolean;
    settings?: Record<string, unknown>;
    errorMessage?: string;
  } = {},
) {
  const type = overrides.type ?? 'SHORT_TEXT';
  const response = await request(app)
    .post(`/api/forms/${formId}/questions`)
    .set('Cookie', cookie)
    .send({
      title: overrides.title ?? 'Pergunta de teste',
      type,
      required: overrides.required ?? false,
      errorMessage: overrides.errorMessage ?? null,
      settings: overrides.settings ?? defaultSettingsFor(type),
    })
    .expect(201);
  return response.body.question as { id: string; key: string };
}

export async function publish(cookie: string, formId: string) {
  await request(app).post(`/api/forms/${formId}/publish`).set('Cookie', cookie).expect(200);
}

export async function getPublicForm(slug: string) {
  const response = await request(app).get(`/api/public/forms/${slug}`).expect(200);
  return response.body.form as {
    slug: string;
    versionNumber: number;
    title: string;
    questions: { key: string; title: string; type: string; required: boolean }[];
  };
}

export function newIdempotencyKey(): string {
  return `teste_${crypto.randomUUID().replace(/-/g, '')}`;
}

export { prisma };