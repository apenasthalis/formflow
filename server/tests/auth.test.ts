import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import {
  TEST_PASSWORD,
  app,
  auth,
  createTestUser,
  destroyTestUser,
  prisma,
  type TestUser,
} from './helpers.js';

describe('Autenticação administrativa', () => {
  let user: TestUser;
  let client: ReturnType<typeof auth>;

  beforeAll(async () => {
    user = await createTestUser('auth');
    client = auth(user.cookie);
  });

  afterAll(async () => {
    await destroyTestUser(user);
  });

  it('recusa credenciais inválidas sem revelar se o e-mail existe', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: 'senha-errada-qualquer' })
      .expect(401);

    expect(response.body.error.message).toBe('E-mail ou senha incorretos.');

    const inexistente = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ninguem@teste.local', password: 'senha-errada-qualquer' })
      .expect(401);

    expect(inexistente.body.error.message).toBe(response.body.error.message);
  });

  it('valida o formato das credenciais', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'invalido', password: '123' })
      .expect(422);

    expect(response.body.error.code).toBe('validation_error');
  });

  it('autentica com credenciais válidas e retorna o usuário sem hash', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: TEST_PASSWORD })
      .expect(200);

    expect(response.body.user).toMatchObject({ email: user.email });
    expect(response.body.user).not.toHaveProperty('passwordHash');
    expect(JSON.stringify(response.body)).not.toContain('passwordHash');
    expect(response.headers['set-cookie']?.[0]).toContain('HttpOnly');
  });

  it('impede o acesso ao painel sem sessão', async () => {
    const response = await request(app).get('/api/forms').expect(401);
    expect(response.body.error.code).toBe('unauthorized');
  });

  it('devolve o usuário autenticado em /me', async () => {
    const response = await client.get('/api/auth/me').expect(200);
    expect(response.body.user.id).toBe(user.id);
  });

  it('invalida a sessão no logout', async () => {
    const temporario = await createTestUser('auth-logout');
    await request(app).post('/api/auth/logout').set('Cookie', temporario.cookie).expect(204);
    await auth(temporario.cookie).get('/api/auth/me').expect(401);
    await destroyTestUser(temporario);
  });

  it('não devolve respostas administrativas a visitantes', async () => {
    await request(app).get('/api/public/forms/qualquer').expect(404);
  });

  it('mantém o login como uma sessão persistida e revogável', async () => {
    const antes = await prisma.session.count({ where: { userId: user.id } });
    expect(antes).toBeGreaterThan(0);

    const rows = await prisma.session.findMany({ where: { userId: user.id } });
    for (const row of rows) {
      expect(row.tokenHash).toHaveLength(64);
      expect(row.tokenHash).not.toContain(user.email);
    }
  });
});