import { QuestionType } from '@prisma/client';
import { prisma } from '../utils/prisma.js';
import { parseSnapshot, type SnapshotQuestion } from '../schemas/snapshot.js';
import { findOwnedForm } from './forms.service.js';

type ExportFilters = { from?: Date; to?: Date };

/** Escapa um valor para CSV (RFC 4180). */
export function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const text = typeof value === 'string' ? value : String(value);
  if (/[",\n\r;]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function toCsvRow(values: unknown[]): string {
  return values.map(csvEscape).join(',');
}

/** Converte a resposta armazenada em um rótulo legível. */
export function humanizeAnswer(question: SnapshotQuestion, text: string | null, json: unknown): string {
  const settings = question.settings as Record<string, never> & {
    options?: { value: string; label: string }[];
    allowOther?: boolean;
    otherLabel?: string;
    yesLabel?: string;
    noLabel?: string;
  };

  const freeText = text && text.trim() !== '' ? text.trim() : '';
  const otherText = `${settings.otherLabel || 'Outro'}: ${freeText}`.trim();

  const readValue = (): string | null => {
    if (json && typeof json === 'object' && 'value' in json) {
      return String((json as { value: unknown }).value);
    }
    return null;
  };

  switch (question.type) {
    case QuestionType.SINGLE_CHOICE: {
      const value = readValue();
      if (value === 'other') return otherText;
      const option = settings.options?.find((item) => item.value === value);
      return option?.label ?? value ?? '';
    }
    case QuestionType.YES_NO: {
      const value = readValue();
      if (value === 'yes') return settings.yesLabel || 'Sim';
      if (value === 'no') return settings.noLabel || 'Não';
      return '';
    }
    case QuestionType.MULTIPLE_CHOICE: {
      if (!json || typeof json !== 'object' || !('selected' in json)) return freeText;
      const selected = (json as { selected: unknown }).selected;
      if (!Array.isArray(selected)) return freeText;
      const labels = selected.map((value) => {
        const key = String(value);
        if (key === 'other') return settings.otherLabel || 'Outro';
        return settings.options?.find((item) => item.value === key)?.label ?? key;
      });
      if (labels.includes(settings.otherLabel || 'Outro') && freeText !== '') {
        labels[labels.length - 1] = otherText;
      }
      return labels.join(' | ');
    }
    case QuestionType.SCALE:
    case QuestionType.RATING:
      return readValue() ?? '';
    default:
      return freeText;
  }
}

/**
 * Gera o CSV com uma linha por submissão. As colunas seguem a ordem das
 * perguntas da versão publicada mais recente do formulário.
 */
export async function exportSubmissionsCsv(
  formId: string,
  ownerId: string,
  filters: ExportFilters,
): Promise<string> {
  const form = await findOwnedForm(formId, ownerId);

  const version = await prisma.formVersion.findFirst({
    where: { formId },
    orderBy: { versionNumber: 'desc' },
  });
  if (!version) throw new Error('Formulário nunca foi publicado.');

  const snapshot = parseSnapshot(version.snapshot);

  const dateFilter: Record<string, Date> = {};
  if (filters.from) dateFilter.gte = filters.from;
  if (filters.to) dateFilter.lte = filters.to;

  const submissions = await prisma.submission.findMany({
    where: {
      formId,
      ...(Object.keys(dateFilter).length > 0 ? { submittedAt: dateFilter } : {}),
    },
    orderBy: { submittedAt: 'asc' },
    include: { answers: { select: { questionKey: true, answerText: true, answerJson: true } } },
  });

  const header = [
    'ID da submissão',
    'Data e hora',
    'Versão do formulário',
    ...snapshot.questions.map((question, index) => `${index + 1}. ${question.title}`),
  ];

  const versionById = new Map<string, number>();
  if (submissions.length > 0) {
    const versions = await prisma.formVersion.findMany({
      where: { formId },
      select: { id: true, versionNumber: true },
    });
    for (const item of versions) versionById.set(item.id, item.versionNumber);
  }

  const rows = submissions.map((submission) => {
    const answers = new Map(submission.answers.map((answer) => [answer.questionKey, answer]));
    return [
      submission.id,
      submission.submittedAt.toISOString(),
      `v${versionById.get(submission.formVersionId) ?? '?'}`,
      ...snapshot.questions.map((question) => {
        const answer = answers.get(question.key);
        if (!answer) return '';
        return humanizeAnswer(question, answer.answerText, answer.answerJson);
      }),
    ];
  });

  return [header, ...rows].map(toCsvRow).join('\r\n');
}