import { FormStatus, Prisma, type Form, type Question } from '@prisma/client';
import { prisma } from '../utils/prisma.js';
import { AppError } from '../utils/errors.js';
import { generateKey, normalizeSettings } from '../utils/questions.js';
import type { FormSnapshot } from '../schemas/snapshot.js';

export type { FormSnapshot };

export const RESERVED_SLUGS = new Set(['api', 'admin', 'f', 'login', 'app', 'assets', 'static']);

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Converte um texto em slug e garante unicidade no banco. */
export async function generateUniqueSlug(title: string, ignoreId?: string): Promise<string> {
  const base =
    title
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'formulario';

  let candidate = base;
  let suffix = 2;

  for (;;) {
    if (RESERVED_SLUGS.has(candidate)) {
      candidate = `${base}-${suffix}`;
      suffix += 1;
      continue;
    }
    const existing = await prisma.form.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!existing || existing.id === ignoreId) return candidate;
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
}

export function assertValidSlug(slug: string): string {
  if (!SLUG_PATTERN.test(slug) || slug.length > 80 || RESERVED_SLUGS.has(slug)) {
    throw AppError.badRequest(
      'O endereço público deve conter apenas letras minúsculas, números e hífens.',
    );
  }
  return slug;
}

export async function findOwnedForm(formId: string, ownerId: string) {
  const form = await prisma.form.findFirst({
    where: { id: formId, ownerId },
    include: { questions: { orderBy: { position: 'asc' } } },
  });
  if (!form) throw AppError.notFound('Formulário não encontrado.');
  return form;
}

export async function findQuestionOwned(questionId: string, ownerId: string) {
  const question = await prisma.question.findUnique({
    where: { id: questionId },
    include: { form: { select: { id: true, ownerId: true, status: true } } },
  });
  if (!question || question.form.ownerId !== ownerId) {
    throw AppError.notFound('Pergunta não encontrada.');
  }
  return question;
}

/** Garante posições 0..n-1 e grava em lote dentro de uma transação. */
export async function resequencePositions(formId: string): Promise<void> {
  const questions = await prisma.question.findMany({
    where: { formId },
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    select: { id: true, position: true },
  });

  await prisma.$transaction(
    questions.map((question, index) =>
      prisma.question.update({
        where: { id: question.id },
        data: { position: index },
      }),
    ),
  );
}

type QuestionForSnapshot = Pick<
  Question,
  'id' | 'key' | 'title' | 'description' | 'type' | 'required' | 'position' | 'settings' | 'errorMessage'
>;

export { type QuestionForSnapshot };

/**
 * Publica o formulário: valida a estrutura e cria uma FormVersion imutável.
 * Toda publicação gera uma nova versão, e as submissões passam a apontar
 * para ela — alterações futuras no rascunho não afetam respostas anteriores.
 *
 * O slug público (o "hash" do link) definido no editor é preservado: publicar
 * apenas muda o status e cria a versão, nunca regenera o endereço. É por isso
 * que o cliente grava o rascunho antes de chamar este endpoint.
 */
export async function publishForm(formId: string, ownerId: string): Promise<Form> {
  const form = await findOwnedForm(formId, ownerId);

  if (form.questions.length === 0) {
    throw AppError.badRequest('Adicione ao menos uma pergunta antes de publicar.');
  }

  const emptyQuestions = form.questions.filter((question) => !question.title.trim());
  if (emptyQuestions.length > 0) {
    throw AppError.badRequest('Todas as perguntas precisam de um enunciado antes de publicar.');
  }

  const lastVersion = await prisma.formVersion.findFirst({
    where: { formId },
    orderBy: { versionNumber: 'desc' },
    select: { versionNumber: true, snapshot: true },
  });

  const snapshot = buildSnapshot(form, form.questions);
  const nextVersionNumber = (lastVersion?.versionNumber ?? 0) + 1;

  // Evita criar uma nova versão quando nada mudou desde a última publicação.
  if (lastVersion && isSameSnapshot(lastVersion.snapshot as unknown as FormSnapshot, snapshot)) {
    const updated = await prisma.form.update({
      where: { id: formId },
      data: { status: FormStatus.PUBLISHED, publishedAt: form.publishedAt ?? new Date() },
    });
    return updated;
  }

  return prisma.$transaction(async (tx) => {
    await tx.formVersion.create({
      data: { formId, versionNumber: nextVersionNumber, snapshot: snapshot as unknown as Prisma.InputJsonValue },
    });

    return tx.form.update({
      where: { id: formId },
      data: {
        status: FormStatus.PUBLISHED,
        publishedAt: form.publishedAt ?? new Date(),
      },
    });
  });
}

export function buildSnapshot(
  form: Pick<Form, 'title' | 'description' | 'welcomeMessage' | 'thankYouMessage'>,
  questions: QuestionForSnapshot[],
): FormSnapshot {
  return {
    title: form.title,
    description: form.description,
    welcomeMessage: form.welcomeMessage,
    thankYouMessage: form.thankYouMessage,
    questions: questions.map((question) => ({
      id: question.id,
      key: question.key,
      title: question.title,
      description: question.description,
      type: question.type,
      required: question.required,
      position: question.position,
      settings: normalizeSettings(
        question.type,
        question.settings as unknown as Record<string, unknown>,
      ).settings,
      errorMessage: question.errorMessage,
    })),
  };
}

function isSameSnapshot(a: FormSnapshot, b: FormSnapshot): boolean {
  // O PostgreSQL (JSONB) não preserva a ordem das chaves, então a comparação
  // usa uma serialização estável.
  return stableStringify(a) === stableStringify(b);
}

/** JSON.stringify com chaves ordenadas, para comparações estruturais. */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));

  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(',')}}`;
}

/** Despublica: a página pública passa a recusar novas respostas. */
export async function unpublishForm(formId: string, ownerId: string): Promise<Form> {
  await findOwnedForm(formId, ownerId);
  return prisma.form.update({ where: { id: formId }, data: { status: FormStatus.DRAFT } });
}

export async function duplicateForm(formId: string, ownerId: string) {
  const source = await findOwnedForm(formId, ownerId);

  const slug = await generateUniqueSlug(`${source.title} (cópia)`);

  return prisma.$transaction(async (tx) => {
    const copy = await tx.form.create({
      data: {
        title: `${source.title} (cópia)`,
        description: source.description,
        slug,
        status: FormStatus.DRAFT,
        welcomeMessage: source.welcomeMessage,
        thankYouMessage: source.thankYouMessage,
        ownerId,
      },
    });

    const questions = await Promise.all(
      source.questions.map((question) =>
        tx.question.create({
          data: {
            formId: copy.id,
            key: generateKey(),
            title: question.title,
            description: question.description,
            type: question.type,
            required: question.required,
            position: question.position,
            settings: question.settings as Prisma.InputJsonValue,
            errorMessage: question.errorMessage,
          },
        }),
      ),
    );

    return { form: copy, questions };
  });
}

/** Versão publicada mais recente de um formulário (usada nas páginas públicas). */
export async function getLatestVersion(formId: string) {
  return prisma.formVersion.findFirst({
    where: { formId },
    orderBy: { versionNumber: 'desc' },
  });
}

/**
 * Indica se o rascunho atual difere da última versão publicada.
 * Como a página pública serve o snapshot da versão, o administrador precisa
 * republicar para que as alterações passem a valer para novas respostas.
 */
export function hasUnpublishedChanges(
  form: Pick<Form, 'title' | 'description' | 'welcomeMessage' | 'thankYouMessage'>,
  questions: QuestionForSnapshot[],
  version: { snapshot: unknown } | null,
): boolean {
  if (!version) return questions.length > 0;
  try {
    return stableStringify(buildSnapshot(form, questions)) !== stableStringify(version.snapshot);
  } catch {
    return true;
  }
}