import { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma.js';
import { AppError } from '../utils/errors.js';
import { QuestionType } from '@prisma/client';
import { parseSnapshot, type FormSnapshot } from '../schemas/snapshot.js';
import { findOwnedForm } from './forms.service.js';

export type AnalyticsFilters = {
  from?: Date;
  to?: Date;
  search?: string;
};

export type ChoiceBucket = {
  value: string;
  label: string;
  count: number;
  percentage: number;
};

export type QuestionAnalytics = {
  key: string;
  title: string;
  type: QuestionType;
  required: boolean;
  answeredCount: number;
  skippedCount: number;
  /** Distribuição para escolhas múltiplas (cada participante pode contar várias vezes). */
  distribution: ChoiceBucket[];
  /** Estatísticas para escala/avaliação. */
  scale: { min: number; max: number; average: number | null; histogram: ChoiceBucket[] } | null;
  /** Amostra de respostas textuais (com busca aplicada). */
  textSamples: { answerId: string; submissionId: string; value: string; submittedAt: string }[];
  textTotalCount: number;
};

export type FormAnalytics = {
  totalSubmissions: number;
  completedSubmissions: number;
  completionRate: number;
  lastSubmissionAt: string | null;
  firstSubmissionAt: string | null;
  averageDurationSeconds: number | null;
  submissionsInPeriod: number;
  questions: QuestionAnalytics[];
};

function readValue(json: unknown): string | null {
  if (json && typeof json === 'object' && 'value' in json) {
    return String((json as { value: unknown }).value);
  }
  return null;
}

function readSelected(json: unknown): string[] {
  if (json && typeof json === 'object' && 'selected' in json) {
    const selected = (json as { selected: unknown }).selected;
    if (Array.isArray(selected)) return selected.map(String);
  }
  return [];
}

function round(value: number, decimals = 1): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export async function getFormAnalytics(
  formId: string,
  ownerId: string,
  filters: AnalyticsFilters,
): Promise<FormAnalytics> {
  const form = await findOwnedForm(formId, ownerId);
  const version = await prisma.formVersion.findFirst({
    where: { formId },
    orderBy: { versionNumber: 'desc' },
  });

  if (!version) {
    return {
      totalSubmissions: 0,
      completedSubmissions: 0,
      completionRate: 0,
      lastSubmissionAt: null,
      firstSubmissionAt: null,
      averageDurationSeconds: null,
      submissionsInPeriod: 0,
      questions: form.questions.map((question) => emptyQuestionAnalytics(question.key, question.title, question.type, question.required)),
    };
  }

  const snapshot: FormSnapshot = parseSnapshot(version.snapshot);

  const dateFilter: Record<string, Date> = {};
  if (filters.from) dateFilter.gte = filters.from;
  if (filters.to) dateFilter.lte = filters.to;

  const whereBase = {
    formId,
    ...(Object.keys(dateFilter).length > 0 ? { submittedAt: dateFilter } : {}),
  };

  const [totalSubmissions, completedSubmissions, aggregates, answers] = await Promise.all([
    prisma.submission.count({ where: whereBase }),
    prisma.submission.count({ where: { ...whereBase, status: 'COMPLETED' } }),
    prisma.submission.aggregate({
      where: whereBase,
      _min: { submittedAt: true },
      _max: { submittedAt: true },
      _avg: { durationSeconds: true },
    }),
    prisma.answer.findMany({
      where: {
        submission: whereBase,
        ...(filters.search ? { answerText: { contains: filters.search, mode: 'insensitive' as const } } : {}),
      },
      select: {
        id: true,
        questionKey: true,
        answerText: true,
        answerJson: true,
        submission: { select: { id: true, submittedAt: true } },
      },
    }),
  ]);

  // Precisa das respostas sem filtro de busca para montar os gráficos.
  const allAnswers = filters.search
    ? await prisma.answer.findMany({
        where: { submission: whereBase },
        select: {
          questionKey: true,
          answerText: true,
          answerJson: true,
        },
      })
    : answers;

  const answersByKey = new Map<string, typeof allAnswers>();
  for (const answer of allAnswers) {
    const list = answersByKey.get(answer.questionKey) ?? [];
    list.push(answer as (typeof allAnswers)[number]);
    answersByKey.set(answer.questionKey, list);
  }

  const textFilteredByKey = new Map<string, typeof answers>();
  for (const answer of answers) {
    const list = textFilteredByKey.get(answer.questionKey) ?? [];
    list.push(answer);
    textFilteredByKey.set(answer.questionKey, list);
  }

  const questions: QuestionAnalytics[] = snapshot.questions.map((question) => {
    const forQuestion = answersByKey.get(question.key) ?? [];
    const answeredCount = forQuestion.length;
    const base: QuestionAnalytics = {
      key: question.key,
      title: question.title,
      type: question.type,
      required: question.required,
      answeredCount,
      skippedCount: Math.max(0, completedSubmissions - answeredCount),
      distribution: [],
      scale: null,
      textSamples: [],
      textTotalCount: 0,
    };

    switch (question.type) {
      case QuestionType.SINGLE_CHOICE:
      case QuestionType.YES_NO:
      case QuestionType.MULTIPLE_CHOICE: {
        const settings = question.settings as {
          options?: { value: string; label: string }[];
          allowOther?: boolean;
          otherLabel?: string;
          yesLabel?: string;
          noLabel?: string;
        };

        const labels = new Map<string, string>();
        if (question.type === QuestionType.YES_NO) {
          labels.set('yes', settings.yesLabel || 'Sim');
          labels.set('no', settings.noLabel || 'Não');
        } else {
          for (const option of settings.options ?? []) labels.set(option.value, option.label);
          if (settings.allowOther) labels.set('other', settings.otherLabel || 'Outro');
        }

        const counts = new Map<string, number>();
        for (const label of labels.values()) counts.set(label, 0);
        for (const answer of forQuestion) {
          if (question.type === QuestionType.MULTIPLE_CHOICE) {
            for (const value of readSelected(answer.answerJson)) {
              const label = labels.get(value);
              if (label) counts.set(label, (counts.get(label) ?? 0) + 1);
            }
          } else {
            const value = readValue(answer.answerJson);
            if (value === null) continue;
            const label = labels.get(value);
            if (label) counts.set(label, (counts.get(label) ?? 0) + 1);
          }
        }

        const total = [...counts.values()].reduce((sum, count) => sum + count, 0);
        base.distribution = [...counts.entries()].map(([label, count]) => ({
          value: label,
          label,
          count,
          percentage: total > 0 ? round((count / total) * 100) : 0,
        }));
        return base;
      }

      case QuestionType.SCALE:
      case QuestionType.RATING: {
        const settings = question.settings as { min?: number; max?: number };
        const min = question.type === QuestionType.SCALE ? (settings.min ?? 0) : 1;
        const max =
          question.type === QuestionType.SCALE ? (settings.max ?? 10) : (settings.max ?? 5);

        const counts = new Map<number, number>();
        for (let value = min; value <= max; value += 1) counts.set(value, 0);

        const values: number[] = [];
        for (const answer of forQuestion) {
          const raw = readValue(answer.answerJson);
          if (raw === null) continue;
          const value = Number(raw);
          if (!Number.isFinite(value)) continue;
          values.push(value);
          if (counts.has(value)) counts.set(value, (counts.get(value) ?? 0) + 1);
        }

        const total = values.length;
        base.scale = {
          min,
          max,
          average: total > 0 ? round(values.reduce((sum, value) => sum + value, 0) / total, 2) : null,
          histogram: [...counts.entries()].map(([value, count]) => ({
            value: String(value),
            label: String(value),
            count,
            percentage: total > 0 ? round((count / total) * 100) : 0,
          })),
        };
        return base;
      }

      default: {
        const texts = forQuestion.filter((answer) => (answer.answerText ?? '').trim() !== '');
        base.textTotalCount = texts.length;
        const filtered = textFilteredByKey.get(question.key) ?? [];
        base.textSamples = filtered
          .filter((answer) => (answer.answerText ?? '').trim() !== '')
          .slice(0, 200)
          .map((answer) => ({
            answerId: answer.id,
            submissionId: answer.submission.id,
            value: (answer.answerText ?? '').trim(),
            submittedAt: answer.submission.submittedAt.toISOString(),
          }));
        return base;
      }
    }
  });

  const requiredKeys = snapshot.questions
    .filter((question) => question.required)
    .map((question) => question.key);
  const fullyCompleted = await countFullyCompleted(formId, dateFilter, requiredKeys);

  return {
    totalSubmissions,
    completedSubmissions,
    completionRate: totalSubmissions > 0 ? round((fullyCompleted / totalSubmissions) * 100) : 0,
    lastSubmissionAt: aggregates._max.submittedAt?.toISOString() ?? null,
    firstSubmissionAt: aggregates._min.submittedAt?.toISOString() ?? null,
    averageDurationSeconds: aggregates._avg.durationSeconds
      ? round(aggregates._avg.durationSeconds, 1)
      : null,
    submissionsInPeriod: totalSubmissions,
    questions,
  };
}

/**
 * Conta as submissões concluídas que responderam todas as perguntas obrigatórias.
 * Feito em SQL para não carregar todas as respostas apenas para contar.
 */
async function countFullyCompleted(
  formId: string,
  dateFilter: Record<string, Date>,
  requiredKeys: string[],
): Promise<number> {
  const conditions: Prisma.Sql[] = [
    Prisma.sql`s."formId" = ${formId}::uuid`,
    Prisma.sql`s."status" = 'COMPLETED'::"SubmissionStatus"`,
  ];
  if (dateFilter.gte) conditions.push(Prisma.sql`s."submittedAt" >= ${dateFilter.gte}`);
  if (dateFilter.lte) conditions.push(Prisma.sql`s."submittedAt" <= ${dateFilter.lte}`);

  if (requiredKeys.length === 0) {
    const rows = await prisma.$queryRaw<{ count: number }[]>(Prisma.sql`
      SELECT COUNT(*)::int AS count FROM "submissions" s WHERE ${Prisma.join(conditions, ' AND ')}
    `);
    return rows[0]?.count ?? 0;
  }

  const rows = await prisma.$queryRaw<{ count: number }[]>(Prisma.sql`
    SELECT COUNT(*)::int AS count
    FROM "submissions" s
    WHERE ${Prisma.join(conditions, ' AND ')}
      AND (
        SELECT COUNT(DISTINCT a."questionKey")
        FROM "answers" a
        WHERE a."submissionId" = s.id AND a."questionKey" = ANY(${requiredKeys}::varchar[])
      ) = ${requiredKeys.length}
  `);
  return rows[0]?.count ?? 0;
}

function emptyQuestionAnalytics(
  key: string,
  title: string,
  type: QuestionType,
  required: boolean,
): QuestionAnalytics {
  return {
    key,
    title,
    type,
    required,
    answeredCount: 0,
    skippedCount: 0,
    distribution: [],
    scale: null,
    textSamples: [],
    textTotalCount: 0,
  };
}

export async function listSubmissions(
  formId: string,
  ownerId: string,
  options: { page: number; pageSize: number; from?: Date; to?: Date; search?: string },
) {
  await findOwnedForm(formId, ownerId);

  const dateFilter: Record<string, Date> = {};
  if (options.from) dateFilter.gte = options.from;
  if (options.to) dateFilter.lte = options.to;

  const search = options.search?.trim();
  const where = {
    formId,
    ...(Object.keys(dateFilter).length > 0 ? { submittedAt: dateFilter } : {}),
    ...(search
      ? {
          OR: [
            { answers: { some: { answerText: { contains: search, mode: 'insensitive' as const } } } },
            {
              answers: {
                some: { answerJson: { path: ['value'], string_contains: search } },
              },
            },
          ],
        }
      : {}),
  };

  const [total, submissions] = await Promise.all([
    prisma.submission.count({ where }),
    prisma.submission.findMany({
      where,
      orderBy: { submittedAt: 'desc' },
      skip: (options.page - 1) * options.pageSize,
      take: options.pageSize,
      select: {
        id: true,
        submittedAt: true,
        status: true,
        durationSeconds: true,
        formVersion: { select: { versionNumber: true } },
        answers: {
          select: {
            questionKey: true,
            answerText: true,
            answerJson: true,
            question: { select: { title: true, type: true, position: true } },
          },
        },
      },
    }),
  ]);

  return {
    total,
    page: options.page,
    pageSize: options.pageSize,
    pageCount: Math.max(1, Math.ceil(total / options.pageSize)),
    submissions: submissions.map((submission) => ({
      id: submission.id,
      submittedAt: submission.submittedAt.toISOString(),
      status: submission.status,
      durationSeconds: submission.durationSeconds,
      versionNumber: submission.formVersion.versionNumber,
      answers: submission.answers.map((answer) => ({
        questionKey: answer.questionKey,
        questionTitle: answer.question?.title ?? answer.questionKey,
        questionType: answer.question?.type ?? null,
        text: answer.answerText,
        json: answer.answerJson,
      })),
    })),
  };
}

export async function getSubmission(formId: string, submissionId: string, ownerId: string) {
  const form = await findOwnedForm(formId, ownerId);

  const submission = await prisma.submission.findFirst({
    where: { id: submissionId, formId },
    include: {
      formVersion: { select: { id: true, versionNumber: true, snapshot: true } },
      answers: { select: { questionKey: true, answerText: true, answerJson: true } },
    },
  });

  if (!submission) throw AppError.notFound('Submissão não encontrada.');

  // As respostas são interpretadas com o snapshot da versão respondida, para
  // que edições posteriores no formulário não mudem o contexto já registrado.
  let snapshot: FormSnapshot | null = null;
  try {
    snapshot = parseSnapshot(submission.formVersion.snapshot);
  } catch {
    snapshot = null;
  }

  const answerByKey = new Map(submission.answers.map((answer) => [answer.questionKey, answer]));

  return {
    id: submission.id,
    submittedAt: submission.submittedAt.toISOString(),
    status: submission.status,
    durationSeconds: submission.durationSeconds,
    form: { id: form.id, title: form.title },
    versionNumber: submission.formVersion.versionNumber,
    answers: snapshot
      ? snapshot.questions.map((question) => ({
          questionKey: question.key,
          title: question.title,
          type: question.type,
          settings: question.settings,
          text: answerByKey.get(question.key)?.answerText ?? null,
          json: answerByKey.get(question.key)?.answerJson ?? null,
        }))
      : submission.answers.map((answer) => ({
          questionKey: answer.questionKey,
          title: answer.questionKey,
          type: QuestionType.SHORT_TEXT,
          settings: {},
          text: answer.answerText,
          json: answer.answerJson,
        })),
  };
}

export type SubmissionDetail = Awaited<ReturnType<typeof getSubmission>>;
export type SubmissionListItem = Awaited<ReturnType<typeof listSubmissions>>['submissions'][number];