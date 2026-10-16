import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  addQuestion,
  auth,
  createForm,
  createTestUser,
  destroyTestUser,
  newIdempotencyKey,
  prisma,
  publish,
  type TestUser,
} from './helpers.js';
import request from 'supertest';
import { app } from './helpers.js';

describe('Resultados, exportação e privacidade', () => {
  let user: TestUser;
  let client: ReturnType<typeof auth>;
  let formId: string;
  let slug: string;
  let keys: Record<string, string>;

  beforeAll(async () => {
    user = await createTestUser('resultados');
    client = auth(user.cookie);
    const form = await createForm(user.cookie, 'Pesquisa analisada');
    formId = form.id;
    slug = form.slug;

    await addQuestion(user.cookie, formId, {
      title: 'Qual canal?',
      type: 'SINGLE_CHOICE',
      required: true,
      settings: {
        options: [
          { value: 'zap', label: 'WhatsApp' },
          { value: 'mail', label: 'E-mail' },
        ],
        allowOther: false,
        otherLabel: 'Outro',
      },
    });
    await addQuestion(user.cookie, formId, {
      title: 'Há quanto tempo participa?',
      type: 'SCALE',
      required: false,
      settings: { min: 0, max: 10, minLabel: 'Pouco', maxLabel: 'Muito' },
    });
    await addQuestion(user.cookie, formId, {
      title: 'Sugestões',
      type: 'LONG_TEXT',
      required: false,
      settings: { placeholder: '', maxLength: 500 },
    });

    await publish(user.cookie, formId);

    const publica = (await (await request(app).get(`/api/public/forms/${slug}`)).body).form as {
      questions: { key: string; title: string }[];
    };
    keys = Object.fromEntries(publica.questions.map((q) => [q.title, q.key])) as Record<
      string,
      string
    >;

    const respostas = [
      { canal: 'zap', escala: '8', texto: 'Adoro os encontros presenciais' },
      { canal: 'zap', escala: '10', texto: 'Mais eventos no bairro' },
      { canal: 'mail', escala: '2', texto: '' },
    ];

    for (const resposta of respostas) {
      const answers: { questionKey: string; value?: string; text?: string }[] = [
        { questionKey: keys['Qual canal?'] as string, value: resposta.canal },
        { questionKey: keys['Há quanto tempo participa?'] as string, value: resposta.escala },
      ];
      if (resposta.texto) {
        answers.push({ questionKey: keys['Sugestões'] as string, text: resposta.texto });
      }

      await request(app)
        .post(`/api/public/forms/${slug}/submissions`)
        .send({ idempotencyKey: newIdempotencyKey(), answers, durationSeconds: 30 })
        .expect(201);
    }
  });

  afterAll(async () => {
    await destroyTestUser(user);
  });

  it('agrega o total de submissões e a taxa de conclusão', async () => {
    const response = await client.get(`/api/forms/${formId}/analytics`).expect(200);
    const analytics = response.body.analytics;

    expect(analytics.totalSubmissions).toBe(3);
    expect(analytics.completionRate).toBe(100);
    expect(analytics.lastSubmissionAt).toBeTruthy();
  });

  it('mostra a distribuição das alternativas', async () => {
    const response = await client.get(`/api/forms/${formId}/analytics`).expect(200);
    const canal = response.body.analytics.questions.find(
      (q: { title: string }) => q.title === 'Qual canal?',
    );

    expect(canal.distribution).toEqual([
      { value: 'WhatsApp', label: 'WhatsApp', count: 2, percentage: 66.7 },
      { value: 'E-mail', label: 'E-mail', count: 1, percentage: 33.3 },
    ]);
  });

  it('calcula média e histograma das escalas', async () => {
    const response = await client.get(`/api/forms/${formId}/analytics`).expect(200);
    const escala = response.body.analytics.questions.find(
      (q: { title: string }) => q.title === 'Há quanto tempo participa?',
    );

    expect(escala.scale.min).toBe(0);
    expect(escala.scale.max).toBe(0 + 10);
    expect(escala.scale.average).toBeCloseTo((8 + 10 + 2) / 3, 1);
    expect(escala.scale.histogram).toHaveLength(11);
  });

  it('lista as respostas textuais e filtra por busca', async () => {
    const analytics = await client
      .get(`/api/forms/${formId}/analytics?search=encontros`)
      .expect(200);
    const sugestoes = analytics.body.analytics.questions.find(
      (q: { title: string }) => q.title === 'Sugestões',
    );

    expect(sugestoes.textSamples).toHaveLength(1);
    expect(sugestoes.textSamples[0].value).toContain('encontros');

    const semResultado = await client
      .get(`/api/forms/${formId}/analytics?search=palavra-inexistente`)
      .expect(200);
    const vazia = semResultado.body.analytics.questions.find(
      (q: { title: string }) => q.title === 'Sugestões',
    );
    expect(vazia.textSamples).toHaveLength(0);
  });

  it('filtra submissões por período', async () => {
    const total = await client.get(`/api/forms/${formId}/submissions`).expect(200);
    expect(total.body.total).toBe(3);

    const futuro = await client
      .get(`/api/forms/${formId}/submissions?from=2999-01-01`)
      .expect(200);
    expect(futuro.body.total).toBe(0);

    const busca = await client
      .get(`/api/forms/${formId}/submissions?search=bairro`)
      .expect(200);
    expect(busca.body.total).toBe(1);
  });

  it('pagina as submissões', async () => {
    const primeiraPagina = await client
      .get(`/api/forms/${formId}/submissions?page=1&pageSize=2`)
      .expect(200);
    expect(primeiraPagina.body.submissions).toHaveLength(2);
    expect(primeiraPagina.body.pageCount).toBe(2);

    const segundaPagina = await client
      .get(`/api/forms/${formId}/submissions?page=2&pageSize=2`)
      .expect(200);
    expect(segundaPagina.body.submissions).toHaveLength(1);

    await client.get(`/api/forms/${formId}/submissions?pageSize=500`).expect(422);
  });

  it('detalha uma submissão usando o snapshot da versão respondida', async () => {
    const lista = await client.get(`/api/forms/${formId}/submissions`).expect(200);
    const submissao = lista.body.submissions[0];

    const detalhe = await client
      .get(`/api/forms/${formId}/submissions/${submissao.id}`)
      .expect(200);

    expect(detalhe.body.submission.answers).toHaveLength(3);
    expect(detalhe.body.submission.versionNumber).toBe(1);
  });

  it('exporta CSV com uma linha por submissão', async () => {
    const response = await client.get(`/api/forms/${formId}/export.csv`).expect(200);

    expect(response.headers['content-type']).toContain('text/csv');
    expect(response.headers['content-disposition']).toContain('.csv');

    const linhas = response.text.trim().split('\r\n');
    expect(linhas).toHaveLength(4);
    expect(linhas[0]).toContain('Qual canal?');
    expect(linhas[1]).toContain('WhatsApp');

    // Aspas e vírgulas no texto são escapadas corretamente.
    await request(app)
      .post(`/api/public/forms/${slug}/submissions`)
      .send({
        idempotencyKey: newIdempotencyKey(),
        answers: [
          { questionKey: keys['Qual canal?'], value: 'zap' },
          { questionKey: keys['Sugestões'], text: 'Texto com "aspas", vírgula e\nnova linha' },
        ],
      })
      .expect(201);

    const atualizado = await client.get(`/api/forms/${formId}/export.csv`).expect(200);
    expect(atualizado.text).toContain('"Texto com ""aspas"", vírgula e\nnova linha"');
  });

  it('não permite que outro administrador consulte as respostas', async () => {
    const intruso = await createTestUser('resultados-intruso');
    const cliente = auth(intruso.cookie);

    await cliente.get(`/api/forms/${formId}/analytics`).expect(404);
    await cliente.get(`/api/forms/${formId}/submissions`).expect(404);
    await cliente.get(`/api/forms/${formId}/export.csv`).expect(404);
    await request(app).get(`/api/public/forms/${slug}/submissions`).expect(404);

    await destroyTestUser(intruso);
  });

  it('não expõe respostas pela API pública', async () => {
    const response = await request(app).get(`/api/public/forms/${slug}`).expect(200);
    expect(JSON.stringify(response.body)).not.toContain('text');
    expect(JSON.stringify(response.body)).not.toContain('submittedAt');
  });

  it('remove o formulário e todas as respostas ao excluir', async () => {
    const descartavel = await createForm(user.cookie, 'Descartável');
    await addQuestion(user.cookie, descartavel.id, { required: true });
    await publish(user.cookie, descartavel.id);

    const publica = await request(app).get(`/api/public/forms/${descartavel.slug}`).expect(200);
    const key = publica.body.form.questions[0].key;
    await request(app)
      .post(`/api/public/forms/${descartavel.slug}/submissions`)
      .send({ idempotencyKey: newIdempotencyKey(), answers: [{ questionKey: key, text: 'oi' }] })
      .expect(201);

    await client.delete(`/api/forms/${descartavel.id}`).expect(204);

    // Formulário, versões, submissões e respostas caem juntos em cascata.
    expect(await prisma.submission.count({ where: { formId: descartavel.id } })).toBe(0);
    expect(await prisma.formVersion.count({ where: { formId: descartavel.id } })).toBe(0);
    expect(await prisma.question.count({ where: { formId: descartavel.id } })).toBe(0);
    expect(await prisma.form.count({ where: { id: descartavel.id } })).toBe(0);
  });
});