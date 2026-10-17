import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  addQuestion,
  app,
  auth,
  createForm,
  createTestUser,
  destroyTestUser,
  getPublicForm,
  newIdempotencyKey,
  prisma,
  publish,
  type TestUser,
} from './helpers.js';
import request from 'supertest';

type Answers = { questionKey: string; text?: string; value?: string; values?: string[] }[];

describe('Respostas públicas', () => {
  let user: TestUser;
  let client: ReturnType<typeof auth>;
  let slug: string;
  let keys: Record<string, string>;

  beforeAll(async () => {
    user = await createTestUser('submissoes');
    client = auth(user.cookie);
    const form = await createForm(user.cookie, 'Pesquisa de teste');
    slug = form.slug;

    await addQuestion(user.cookie, form.id, {
      title: 'Qual seu nome?',
      type: 'SHORT_TEXT',
      required: true,
      settings: { placeholder: 'Seu nome', maxLength: 80 },
    });
    await addQuestion(user.cookie, form.id, {
      title: 'Você participa de comunidade?',
      type: 'YES_NO',
      required: true,
    });
    await addQuestion(user.cookie, form.id, {
      title: 'Canais',
      type: 'MULTIPLE_CHOICE',
      settings: {
        options: [
          { value: 'zap', label: 'WhatsApp' },
          { value: 'fis', label: 'Presencial' },
        ],
        allowOther: true,
        otherLabel: 'Outro',
      },
    });
    await addQuestion(user.cookie, form.id, {
      title: 'Nota',
      type: 'RATING',
      required: false,
      settings: { max: 5, lowLabel: 'Ruim', highLabel: 'Ótimo' },
    });
    await addQuestion(user.cookie, form.id, {
      title: 'Comentário',
      type: 'LONG_TEXT',
      required: false,
      settings: { placeholder: '', maxLength: 500 },
    });

    await publish(user.cookie, form.id);

    const publica = await getPublicForm(slug);
    keys = Object.fromEntries(
      publica.questions.map((question) => [question.title, question.key]),
    );
  });

  afterAll(async () => {
    await destroyTestUser(user);
  });

  function validAnswers(): Answers {
    return [
      { questionKey: keys['Qual seu nome?']!, text: 'Ana Souza' },
      { questionKey: keys['Você participa de comunidade?']!, value: 'yes' },
      { questionKey: keys['Canais']!, values: ['zap', 'other'], text: 'LinkedIn' },
      { questionKey: keys['Nota']!, value: '4' },
      { questionKey: keys['Comentário']!, text: 'Muito bom, continue assim.' },
    ];
  }

  it('só publica o formulário depois de publicado', async () => {
    const rascunho = await createForm(user.cookie, 'Ainda não publicado');
    await addQuestion(user.cookie, rascunho.id);

    await request(app).get(`/api/public/forms/${rascunho.slug}`).expect(404);
    await request(app)
      .post(`/api/public/forms/${rascunho.slug}/submissions`)
      .send({ idempotencyKey: newIdempotencyKey(), answers: [] })
      .expect(404);
  });

  it('exibe somente as informações necessárias para responder', async () => {
    const form = await getPublicForm(slug);
    expect(form.questions).toHaveLength(5);
    expect(JSON.stringify(form)).not.toContain('ownerId');
    expect(JSON.stringify(form)).not.toContain('submission');
  });

  it('salva a submissão e todas as respostas no PostgreSQL', async () => {
    const response = await request(app)
      .post(`/api/public/forms/${slug}/submissions`)
      .send({
        idempotencyKey: newIdempotencyKey(),
        durationSeconds: 77,
        answers: validAnswers(),
      })
      .expect(201);

    const submissionId = response.body.submissionId as string;
    expect(submissionId).toBeTruthy();

    const stored = await prisma.submission.findUnique({
      where: { id: submissionId },
      include: { answers: true, formVersion: true },
    });

    expect(stored?.answers).toHaveLength(5);
    expect(stored?.durationSeconds).toBe(77);

    const nome = stored?.answers.find((answer) => answer.questionKey === keys['Qual seu nome?']);
    expect(nome?.answerText).toBe('Ana Souza');

    const canais = stored?.answers.find((answer) => answer.questionKey === keys['Canais']);
    expect(canais?.answerJson).toEqual({ selected: ['zap', 'other'] });
    expect(canais?.answerText).toBe('LinkedIn');

    const nota = stored?.answers.find((answer) => answer.questionKey === keys['Nota']);
    expect(nota?.answerJson).toEqual({ value: '4' });

    // A submissão aponta para a versão publicada no momento da resposta.
    const versao = await prisma.formVersion.findFirstOrThrow({
      where: { id: stored!.formVersionId },
    });
    expect(versao.versionNumber).toBe(1);
  });

  it('exige as respostas obrigatórias e personaliza a mensagem de erro', async () => {
    const form = await createForm(user.cookie, 'Com mensagem de erro');
    await addQuestion(user.cookie, form.id, {
      title: 'Seu e-mail?',
      type: 'SHORT_TEXT',
      required: true,
      errorMessage: 'Precisamos do seu e-mail.',
    });
    await publish(user.cookie, form.id);

    const publica = await getPublicForm(form.slug);
    const key = publica.questions[0]!.key;

    const semResposta = await request(app)
      .post(`/api/public/forms/${form.slug}/submissions`)
      .send({ idempotencyKey: newIdempotencyKey(), answers: [] })
      .expect(422);
    expect(semResposta.body.error.details[key]).toBe('Precisamos do seu e-mail.');

    const soEspaco = await request(app)
      .post(`/api/public/forms/${form.slug}/submissions`)
      .send({ idempotencyKey: newIdempotencyKey(), answers: [{ questionKey: key, text: '   ' }] })
      .expect(422);
    expect(soEspaco.body.error.details[key]).toBe('Precisamos do seu e-mail.');

    await request(app)
      .post(`/api/public/forms/${form.slug}/submissions`)
      .send({ idempotencyKey: newIdempotencyKey(), answers: [{ questionKey: key, text: 'a@b.com' }] })
      .expect(201);
  });

  it('valida a resposta conforme o tipo da pergunta', async () => {
    const cases: { answers: Answers; detalhes: RegExp }[] = [
      {
        answers: [
          { questionKey: keys['Qual seu nome?']!, text: 'Ana' },
          { questionKey: keys['Você participa de comunidade?']!, value: 'talvez' },
        ],
        detalhes: /duas opções/i,
      },
      {
        answers: [
          { questionKey: keys['Qual seu nome?']!, text: 'Ana' },
          { questionKey: keys['Você participa de comunidade?']!, value: 'yes' },
          { questionKey: keys['Canais']!, values: ['opcao-invalida'] },
        ],
        detalhes: /não é válida/i,
      },
      {
        answers: [
          { questionKey: keys['Qual seu nome?']!, text: 'Ana' },
          { questionKey: keys['Você participa de comunidade?']!, value: 'yes' },
          { questionKey: keys['Canais']!, values: ['zap', 'zap'] },
        ],
        detalhes: /duas vezes/i,
      },
      {
        answers: [
          { questionKey: keys['Qual seu nome?']!, text: 'Ana' },
          { questionKey: keys['Você participa de comunidade?']!, value: 'yes' },
          { questionKey: keys['Nota']!, value: '99' },
        ],
        detalhes: /entre 1 e 5/i,
      },
    ];

    for (const testCase of cases) {
      const response = await request(app)
        .post(`/api/public/forms/${slug}/submissions`)
        .send({ idempotencyKey: newIdempotencyKey(), answers: testCase.answers })
        .expect(422);
      expect(JSON.stringify(response.body.error.details)).toMatch(testCase.detalhes);
    }
  });

  it('aceita apenas e-mails válidos na pergunta do tipo e-mail', async () => {
    const form = await createForm(user.cookie, 'Coleta de e-mail');
    await addQuestion(user.cookie, form.id, {
      title: 'Qual seu e-mail?',
      type: 'EMAIL',
      required: true,
    });
    await publish(user.cookie, form.id);

    const publica = await getPublicForm(form.slug);
    expect(publica.questions[0]!.type).toBe('EMAIL');
    const key = publica.questions[0]!.key;

    for (const invalido of ['ana@', '@exemplo.com', 'anaSouza', 'ana @exemplo.com', 'ana@exemplo']) {
      const recusa = await request(app)
        .post(`/api/public/forms/${form.slug}/submissions`)
        .send({ idempotencyKey: newIdempotencyKey(), answers: [{ questionKey: key, text: invalido }] })
        .expect(422);
      expect(recusa.body.error.details[key]).toMatch(/e-mail válido/i);
    }

    // Vazio continua sendo tratado como "não respondida".
    await request(app)
      .post(`/api/public/forms/${form.slug}/submissions`)
      .send({ idempotencyKey: newIdempotencyKey(), answers: [] })
      .expect(422);

    const valido = await request(app)
      .post(`/api/public/forms/${form.slug}/submissions`)
      .send({
        idempotencyKey: newIdempotencyKey(),
        answers: [{ questionKey: key, text: '  Ana.Souza+contato@exemplo.com.br  ' }],
      })
      .expect(201);

    const resposta = await prisma.answer.findFirstOrThrow({
      where: { submissionId: valido.body.submissionId },
    });
    expect(resposta.answerText).toBe('Ana.Souza+contato@exemplo.com.br');
  });

  it('aceita texto longo sem limite de caracteres e só recusa o vazio', async () => {
    const form = await createForm(user.cookie, 'Texto livre');
    await addQuestion(user.cookie, form.id, { title: 'Conte tudo', type: 'LONG_TEXT', required: true });
    await publish(user.cookie, form.id);

    const key = (await getPublicForm(form.slug)).questions[0]!.key;
    const longa = 'PALAVRA '.repeat(3000).trim();

    const resposta = await request(app)
      .post(`/api/public/forms/${form.slug}/submissions`)
      .send({ idempotencyKey: newIdempotencyKey(), answers: [{ questionKey: key, text: longa }] })
      .expect(201);

    const gravada = await prisma.answer.findFirstOrThrow({
      where: { submissionId: resposta.body.submissionId },
    });
    expect(gravada.answerText).toHaveLength(longa.length);

    // Espaço em branco continua contando como não respondida.
    await request(app)
      .post(`/api/public/forms/${form.slug}/submissions`)
      .send({ idempotencyKey: newIdempotencyKey(), answers: [{ questionKey: key, text: '   ' }] })
      .expect(422);
  });

  it('aceita apenas números na pergunta do tipo número', async () => {
    const form = await createForm(user.cookie, 'Resposta numérica');
    await addQuestion(user.cookie, form.id, {
      title: 'Quanto você pagou?',
      type: 'NUMBER',
      required: true,
    });
    await publish(user.cookie, form.id);

    const publica = await getPublicForm(form.slug);
    expect(publica.questions[0]!.type).toBe('NUMBER');
    const key = publica.questions[0]!.key;

    for (const invalido of ['abc', '12 reais', '1,2,3', '3.4.5', '10%']) {
      const recusa = await request(app)
        .post(`/api/public/forms/${form.slug}/submissions`)
        .send({ idempotencyKey: newIdempotencyKey(), answers: [{ questionKey: key, text: invalido }] })
        .expect(422);
      expect(recusa.body.error.details[key]).toMatch(/apenas números/i);
    }

    for (const valido of ['42', '-3', '1.234', '1.234,56', '0,5', '1 234,56']) {
      const resposta = await request(app)
        .post(`/api/public/forms/${form.slug}/submissions`)
        .send({ idempotencyKey: newIdempotencyKey(), answers: [{ questionKey: key, text: valido }] })
        .expect(201);
      // O texto é gravado como foi digitado.
      const gravada = await prisma.answer.findFirstOrThrow({
        where: { submissionId: resposta.body.submissionId },
      });
      expect(gravada.answerText).toBe(valido);
    }
  });

  it('aceita pular perguntas opcionais', async () => {
    const response = await request(app)
      .post(`/api/public/forms/${slug}/submissions`)
      .send({
        idempotencyKey: newIdempotencyKey(),
        answers: [
          { questionKey: keys['Qual seu nome?']!, text: 'Sem opcionais' },
          { questionKey: keys['Você participa de comunidade?']!, value: 'no' },
        ],
      })
      .expect(201);

    const stored = await prisma.answer.count({
      where: { submissionId: response.body.submissionId },
    });
    expect(stored).toBe(2);
  });

  it('não grava duas submissões para a mesma chave de idempotência', async () => {
    const idempotencyKey = newIdempotencyKey();
    const payload = { idempotencyKey, answers: validAnswers() };

    const primeira = await request(app)
      .post(`/api/public/forms/${slug}/submissions`)
      .send(payload)
      .expect(201);
    expect(primeira.body.duplicate).toBe(false);

    for (let tentativa = 0; tentativa < 3; tentativa += 1) {
      const repetida = await request(app)
        .post(`/api/public/forms/${slug}/submissions`)
        .send(payload)
        .expect(201);
      expect(repetida.body.duplicate).toBe(true);
      expect(repetida.body.submissionId).toBe(primeira.body.submissionId);
    }

    const total = await prisma.submission.count({
      where: { idempotencyKey },
    });
    expect(total).toBe(1);
  });

  it('suporta submissões simultâneas sem perder respostas', async () => {
    const payloads = Array.from({ length: 5 }, (_, index) => ({
      idempotencyKey: newIdempotencyKey(),
      answers: validAnswers().map((answer) =>
        'text' in answer && answer.questionKey === keys['Qual seu nome?']
          ? { ...answer, text: `Participante ${index}` }
          : answer,
      ),
    }));

    const respostas = await Promise.all(
      payloads.map((payload) =>
        request(app).post(`/api/public/forms/${slug}/submissions`).send(payload),
      ),
    );

    for (const resposta of respostas) {
      expect(resposta.status).toBe(201);
    }

    const ids = new Set(respostas.map((resposta) => resposta.body.submissionId));
    expect(ids.size).toBe(payloads.length);

    const salvas = await prisma.answer.count({
      where: { submissionId: { in: [...ids] as string[] } },
    });
    expect(salvas).toBe(payloads.length * 5);
  });

  it('preserva o contexto da versão respondida após novas edições', async () => {
    const form = await createForm(user.cookie, 'Histórico');
    await addQuestion(user.cookie, form.id, { title: 'Pergunta original', required: true });
    await publish(user.cookie, form.id);

    const publica = await getPublicForm(form.slug);
    const keyOriginal = publica.questions[0]!.key;

    const resposta = await request(app)
      .post(`/api/public/forms/${form.slug}/submissions`)
      .send({
        idempotencyKey: newIdempotencyKey(),
        answers: [{ questionKey: keyOriginal, text: 'Resposta original' }],
      })
      .expect(201);

    // Renomeia a pergunta, publica de novo e altera as opções.
    const pergunta = (await client.get(`/api/forms/${form.id}`)).body.form.questions[0];
    await client
      .patch(`/api/questions/${pergunta.id}`)
      .send({ title: 'Pergunta renomeada' })
      .expect(200);
    await client.post(`/api/forms/${form.id}/publish`).expect(200);

    const detalhe = await client
      .get(`/api/forms/${form.id}/submissions/${resposta.body.submissionId}`)
      .expect(200);

    expect(detalhe.body.submission.versionNumber).toBe(1);
    expect(detalhe.body.submission.answers[0].title).toBe('Pergunta original');
    expect(detalhe.body.submission.answers[0].text).toBe('Resposta original');

    const versao = await prisma.formVersion.findFirstOrThrow({
      where: { formId: form.id },
      orderBy: { versionNumber: 'desc' },
    });
    expect(versao.versionNumber).toBe(2);
  });

  it('recusa payloads malformados', async () => {
    await request(app)
      .post(`/api/public/forms/${slug}/submissions`)
      .send({ idempotencyKey: 'curta', answers: [] })
      .expect(422);

    await request(app)
      .post(`/api/public/forms/${slug}/submissions`)
      .send({ idempotencyKey: newIdempotencyKey(), answers: [{ questionKey: 'x'.repeat(100) }] })
      .expect(422);
  });

  it('mantém o mesmo link e sinaliza alterações ainda não publicadas', async () => {
    const lista = await client.get('/api/forms').expect(200);
    const form = lista.body.forms.find((item: { slug: string }) => item.slug === slug);

    await client
      .patch(`/api/forms/${form.id}`)
      .send({ title: 'Pesquisa de teste (atualizada)' })
      .expect(200);

    // A página pública continua no mesmo link, servindo a versão publicada.
    const antesDaRepublicacao = await getPublicForm(slug);
    expect(antesDaRepublicacao.title).toBe('Pesquisa de teste');

    const detalhe = await client.get(`/api/forms/${form.id}`).expect(200);
    expect(detalhe.body.form.title).toBe('Pesquisa de teste (atualizada)');
    expect(detalhe.body.form.hasUnpublishedChanges).toBe(true);

    await publish(user.cookie, form.id);

    const atualizada = await getPublicForm(slug);
    expect(atualizada.title).toBe('Pesquisa de teste (atualizada)');
    expect(atualizada.versionNumber).toBe(2);

    const depois = await client.get(`/api/forms/${form.id}`).expect(200);
    expect(depois.body.form.hasUnpublishedChanges).toBe(false);
  });
});