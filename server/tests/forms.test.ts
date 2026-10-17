import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import {
  addQuestion,
  app,
  auth,
  createForm,
  createTestUser,
  destroyTestUser,
  prisma,
  type TestUser,
} from './helpers.js';

describe('Formulários, perguntas e publicação', () => {
  let user: TestUser;
  let outro: TestUser;
  let client: ReturnType<typeof auth>;

  beforeAll(async () => {
    user = await createTestUser('forms');
    outro = await createTestUser('forms-outro');
    client = auth(user.cookie);
  });

  afterAll(async () => {
    await destroyTestUser(user);
    await destroyTestUser(outro);
  });

  it('cria um formulário com slug público único', async () => {
    const primeiro = await createForm(user.cookie, 'Pesquisa de Bairro');
    expect(primeiro.slug).toBe('pesquisa-de-bairro');
    expect(primeiro.status).toBe('DRAFT');

    const segundo = await createForm(user.cookie, 'Pesquisa de Bairro');
    expect(segundo.slug).toBe('pesquisa-de-bairro-2');
    expect(segundo.id).not.toBe(primeiro.id);
  });

  it('recusa slugs inválidos ou já usados', async () => {
    await client
      .post('/api/forms')
      .send({ title: 'Slug ruim', slug: 'Slug Com Espaco' })
      .expect(400);

    const existente = await createForm(user.cookie, 'Formulário Com Slug');
    await client
      .post('/api/forms')
      .send({ title: 'Outro', slug: existente.slug })
      .expect(409);
  });

  it('cadastra, reordena e remove perguntas', async () => {
    const form = await createForm(user.cookie, 'Editor');
    const primeira = await addQuestion(user.cookie, form.id, { title: 'Primeira' });
    const segunda = await addQuestion(user.cookie, form.id, { title: 'Segunda' });
    const terceira = await addQuestion(user.cookie, form.id, { title: 'Terceira' });

    const atual = await client.get(`/api/forms/${form.id}`).expect(200);
    expect(atual.body.form.questions.map((q: { id: string }) => q.id)).toEqual([
      primeira.id,
      segunda.id,
      terceira.id,
    ]);

    await client
      .post(`/api/forms/${form.id}/questions/reorder`)
      .send({ questionIds: [terceira.id, primeira.id, segunda.id] })
      .expect(200);

    const reordenado = await client.get(`/api/forms/${form.id}`).expect(200);
    expect(reordenado.body.form.questions.map((q: { id: string }) => q.id)).toEqual([
      terceira.id,
      primeira.id,
      segunda.id,
    ]);
    expect(reordenado.body.form.questions.map((q: { position: number }) => q.position)).toEqual([
      0, 1, 2,
    ]);

    await client.delete(`/api/questions/${segunda.id}`).expect(204);
    const depois = await client.get(`/api/forms/${form.id}`).expect(200);
    expect(depois.body.form.questions.map((q: { position: number }) => q.position)).toEqual([0, 1]);
  });

  it('recusa reordenação com perguntas de outro formulário', async () => {
    const formA = await createForm(user.cookie, 'Form A');
    const formB = await createForm(user.cookie, 'Form B');
    const a = await addQuestion(user.cookie, formA.id);
    const b = await addQuestion(user.cookie, formB.id);

    await client
      .post(`/api/forms/${formA.id}/questions/reorder`)
      .send({ questionIds: [a.id, b.id] })
      .expect(400);
  });

  it('valida as configurações específicas de cada tipo de pergunta', async () => {
    const form = await createForm(user.cookie, 'Validação');
    await client
      .post(`/api/forms/${form.id}/questions`)
      .send({
        title: 'Escolha sem alternativas',
        type: 'SINGLE_CHOICE',
        settings: { options: [], allowOther: false },
      })
      .expect(422);

    await client
      .post(`/api/forms/${form.id}/questions`)
      .send({ title: 'Escala invertida', type: 'SCALE', settings: { min: 10, max: 2 } })
      .expect(422);

    // Enunciado vazio é aceito durante a edição, mas impede a publicação.
    await client
      .post(`/api/forms/${form.id}/questions`)
      .send({ title: '', type: 'SHORT_TEXT', settings: { placeholder: '', maxLength: 100 } })
      .expect(201);
    const comPerguntaVazia = await createForm(user.cookie, 'Pergunta sem título');
    await client
      .post(`/api/forms/${comPerguntaVazia.id}/questions`)
      .send({ title: '   ', type: 'SHORT_TEXT', settings: { placeholder: '', maxLength: 100 } })
      .expect(201);

    const tentativa = await client.post(`/api/forms/${comPerguntaVazia.id}/publish`).expect(400);
    expect(tentativa.body.error.message).toMatch(/enunciado/i);
  });

  it('duplica perguntas e formulários completos', async () => {
    const form = await createForm(user.cookie, 'Para duplicar');
    await addQuestion(user.cookie, form.id, { title: 'Original' });
    await addQuestion(user.cookie, form.id, { title: 'Outra', type: 'YES_NO' });

    const pergunta = (await client.get(`/api/forms/${form.id}`)).body.form.questions[0];

    const duplicada = await client.post(`/api/questions/${pergunta.id}/duplicate`).expect(201);
    expect(duplicada.body.question.title).toContain('Original');
    expect(duplicada.body.question.key).not.toBe(pergunta.key);

    await client.post(`/api/forms/${form.id}/publish`).expect(200);
    const copia = await client.post(`/api/forms/${form.id}/duplicate`).expect(201);
    expect(copia.body.form.status).toBe('DRAFT');
    expect(copia.body.form.slug).not.toBe(form.slug);
    expect(copia.body.form.questions).toHaveLength(3);
  });

  it('impede publicar um formulário sem perguntas', async () => {
    const form = await createForm(user.cookie, 'Vazio');
    const response = await client.post(`/api/forms/${form.id}/publish`).expect(400);
    expect(response.body.error.message).toMatch(/pergunta/i);
  });

  it('cria uma nova versão a cada publicação e só quando o conteúdo muda', async () => {
    const form = await createForm(user.cookie, 'Versionado');
    await addQuestion(user.cookie, form.id, { title: 'Pergunta versionada' });

    await client.post(`/api/forms/${form.id}/publish`).expect(200);
    const depoisDaPrimeira = await prisma.formVersion.count({ where: { formId: form.id } });

    await client.post(`/api/forms/${form.id}/publish`).expect(200);
    const depoisDaSegunda = await prisma.formVersion.count({ where: { formId: form.id } });
    expect(depoisDaSegunda).toBe(depoisDaPrimeira);

    await addQuestion(user.cookie, form.id, { title: 'Nova pergunta' });
    await client.post(`/api/forms/${form.id}/publish`).expect(200);
    const depoisDaTerceira = await prisma.formVersion.count({ where: { formId: form.id } });
    expect(depoisDaTerceira).toBe(depoisDaPrimeira + 1);
  });

  it('troca o tipo da pergunta e reinicia as configurações do novo tipo', async () => {
    const form = await createForm(user.cookie, 'Troca de tipo');
    const pergunta = await addQuestion(user.cookie, form.id, {
      title: 'Escolha uma',
      type: 'SHORT_TEXT',
      settings: { placeholder: 'digite aqui', maxLength: 120 },
    });

    // Com settings: o que foi enviado vale.
    const comSettings = await client
      .patch(`/api/questions/${pergunta.id}`)
      .send({
        type: 'SINGLE_CHOICE',
        settings: {
          options: [
            { value: 'a', label: 'A' },
            { value: 'b', label: 'B' },
          ],
          allowOther: true,
          otherLabel: 'Outro',
        },
      })
      .expect(200);
    expect(comSettings.body.question.type).toBe('SINGLE_CHOICE');
    expect(comSettings.body.question.settings.options).toHaveLength(2);

    // Sem settings: o novo tipo entra com as configurações padrão, em vez de
    // recusar um payload escrito para o tipo anterior.
    const semSettings = await client
      .patch(`/api/questions/${pergunta.id}`)
      .send({ type: 'YES_NO' })
      .expect(200);
    expect(semSettings.body.question.type).toBe('YES_NO');
    expect(semSettings.body.question.settings).toEqual({ yesLabel: 'Sim', noLabel: 'Não' });

    // Enunciado e obrigatoriedade continuam como estavam.
    expect(semSettings.body.question.title).toBe('Escolha uma');

    // Settings inválidas para o novo tipo continuam sendo recusadas.
    await client
      .patch(`/api/questions/${pergunta.id}`)
      .send({ type: 'SCALE', settings: { min: 10, max: 2 } })
      .expect(422);
  });

  it('mantém o slug definido no editor ao publicar', async () => {
    const form = await createForm(user.cookie, 'Link definitivo');
    await addQuestion(user.cookie, form.id, { title: 'Pergunta' });

    const editado = await client
      .patch(`/api/forms/${form.id}`)
      .send({ slug: 'link-definitivo-editado' })
      .expect(200);
    expect(editado.body.form.slug).toBe('link-definitivo-editado');

    const publicado = await client.post(`/api/forms/${form.id}/publish`).expect(200);
    expect(publicado.body.form.slug).toBe('link-definitivo-editado');
    expect(publicado.body.form.status).toBe('PUBLISHED');

    // O link publicado é o do editor: o endereço antigo deixa de responder.
    await request(app).get('/api/public/forms/link-definitivo-editado').expect(200);
    await request(app).get('/api/public/forms/link-definitivo').expect(404);

    // Republicar continua usando o mesmo endereço.
    await client.post(`/api/forms/${form.id}/publish`).expect(200);
    expect((await client.get(`/api/forms/${form.id}`)).body.form.slug).toBe('link-definitivo-editado');
  });

  it('despublica, arquiva e exclui', async () => {
    const form = await createForm(user.cookie, 'Ciclo de vida');
    await addQuestion(user.cookie, form.id);

    await client.post(`/api/forms/${form.id}/publish`).expect(200);
    await client.post(`/api/forms/${form.id}/unpublish`).expect(200);
    expect((await client.get(`/api/forms/${form.id}`)).body.form.status).toBe('DRAFT');

    await client.post(`/api/forms/${form.id}/archive`).expect(200);
    expect((await client.get(`/api/forms/${form.id}`)).body.form.status).toBe('ARCHIVED');

    await client.delete(`/api/forms/${form.id}`).expect(204);
    await client.get(`/api/forms/${form.id}`).expect(404);
  });

  it('isola os dados entre administradores', async () => {
    const form = await createForm(user.cookie, 'Privado');
    await client.get(`/api/forms/${form.id}`).expect(200);

    const intruso = auth(outro.cookie);
    await intruso.get(`/api/forms/${form.id}`).expect(404);
    await intruso.patch(`/api/forms/${form.id}`).send({ title: 'Invadido' }).expect(404);
    await intruso.delete(`/api/forms/${form.id}`).expect(404);
    await intruso.post(`/api/forms/${form.id}/publish`).expect(404);

    const lista = await intruso.get('/api/forms').expect(200);
    expect(lista.body.forms).toHaveLength(0);
  });

  it('protege os endpoints administrativos contra acesso anônimo', async () => {
    const form = await createForm(user.cookie, 'Protegido');
    for (const [method, url] of [
      ['get', `/api/forms/${form.id}`],
      ['get', `/api/forms/${form.id}/analytics`],
      ['get', `/api/forms/${form.id}/submissions`],
      ['get', `/api/forms/${form.id}/export.csv`],
    ] as const) {
      await request(app)[method](url).expect(401);
    }
  });
});