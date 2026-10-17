import { Prisma, QuestionType, SubmissionStatus } from '@prisma/client';
import { prisma } from '../utils/prisma.js';
import { AppError } from '../utils/errors.js';
import { emailAnswerSchema } from '../schemas/question.js';
import { parseNumericAnswer } from '../utils/questions.js';
import type { FormSnapshot, FormVersionSnapshot } from '../schemas/snapshot.js';

export type AnswerInput = {
  questionKey: string;
  /** Texto (texto curto/longo, "outro"). */
  text?: string | null;
  /** Valor único selecionado (escolha única, sim/não, escala, avaliação). */
  value?: string | number | null;
  /** Valores selecionados (múltipla escolha). */
  values?: string[] | null;
};

export type ValidatedAnswer = {
  questionKey: string;
  answerText: string | null;
  answerJson: Prisma.InputJsonValue | undefined;
};

export type ValidationResult = {
  valid: boolean;
  errors: Record<string, string>;
  answers: ValidatedAnswer[];
};

type SnapshotQuestion = FormSnapshot['questions'][number];

function optionValues(question: SnapshotQuestion): Set<string> {
  const settings = question.settings as { options?: { value: string }[] };
  return new Set((settings.options ?? []).map((option) => option.value));
}

function allowOther(question: SnapshotQuestion): boolean {
  return Boolean((question.settings as { allowOther?: boolean })?.allowOther);
}

/**
 * Valida a submissão inteira contra o snapshot da versão publicada.
 * Retorna todos os erros de uma vez para que o participante possa corrigir.
 */
export function validateSubmission(
  snapshot: FormSnapshot,
  answers: AnswerInput[],
): ValidationResult {
  const errors: Record<string, string> = {};
  const validated: ValidatedAnswer[] = [];
  const byKey = new Map(answers.map((answer) => [answer.questionKey, answer]));

  for (const question of snapshot.questions) {
    const answer = byKey.get(question.key);
    const error = validateAnswer(question, answer);
    if (error) {
      errors[question.key] = question.errorMessage?.trim() || error;
      continue;
    }
    if (answer) {
      const normalized = normalizeAnswer(question, answer);
      if (normalized) validated.push({ questionKey: question.key, ...normalized });
    }
  }

  return { valid: Object.keys(errors).length === 0, errors, answers: validated };
}

function validateAnswer(question: SnapshotQuestion, answer: AnswerInput | undefined): string | null {
  const settings = question.settings as {
    min?: number;
    max?: number;
  };
  const empty = answer === undefined || isEmptyAnswer(answer);

  if (empty) {
    return question.required ? 'Esta pergunta é obrigatória.' : null;
  }

  switch (question.type) {
    case QuestionType.SHORT_TEXT:
    case QuestionType.LONG_TEXT: {
      // Texto livre: sem limite de caracteres, só a obrigatoriedade.
      const text = answer?.text?.trim() ?? '';
      if (!text) return question.required ? 'Esta pergunta é obrigatória.' : null;
      return null;
    }

    case QuestionType.EMAIL: {
      const text = answer?.text?.trim() ?? '';
      if (!text) return question.required ? 'Esta pergunta é obrigatória.' : null;
      return emailAnswerSchema.safeParse(text).success ? null : 'Informe um e-mail válido.';
    }

    case QuestionType.NUMBER: {
      const text = answer?.text?.trim() ?? '';
      if (!text) return question.required ? 'Esta pergunta é obrigatória.' : null;
      return parseNumericAnswer(text) === null ? 'Informe apenas números.' : null;
    }

    case QuestionType.SINGLE_CHOICE: {
      const value = String(answer?.value ?? '');
      const allowed = optionValues(question);
      if (allowed.has(value)) return null;
      if (allowOther(question) && value === 'other') return null;
      return 'Selecione uma das alternativas.';
    }

    case QuestionType.MULTIPLE_CHOICE: {
      const values = (answer?.values ?? []).map(String);
      if (values.length === 0) return 'Selecione ao menos uma alternativa.';
      const allowed = optionValues(question);
      const allValid = values.every(
        (value) => allowed.has(value) || (allowOther(question) && value === 'other'),
      );
      if (!allValid) return 'Uma das alternativas selecionadas não é válida.';
      const unique = new Set(values);
      if (unique.size !== values.length) return 'Não selecione a mesma alternativa duas vezes.';
      return null;
    }

    case QuestionType.YES_NO: {
      const value = String(answer?.value ?? '');
      return value === 'yes' || value === 'no' ? null : 'Escolha uma das duas opções.';
    }

    case QuestionType.SCALE: {
      const number = Number(answer?.value);
      const min = settings.min ?? 0;
      const max = settings.max ?? 10;
      if (!Number.isInteger(number)) return 'Escolha um número dentro da escala.';
      if (number < min || number > max) return `Escolha um valor entre ${min} e ${max}.`;
      return null;
    }

    case QuestionType.RATING: {
      const number = Number(answer?.value);
      const max = (question.settings as { max?: number }).max ?? 5;
      if (!Number.isInteger(number)) return 'Escolha uma nota válida.';
      if (number < 1 || number > max) return `Escolha uma nota entre 1 e ${max}.`;
      return null;
    }

    default:
      return 'Tipo de pergunta não suportado.';
  }
}

function isEmptyAnswer(answer: AnswerInput): boolean {
  if (answer.text != null && answer.text.trim() !== '') return false;
  if (answer.value != null && String(answer.value).trim() !== '') return false;
  if (answer.values != null && answer.values.length > 0) return false;
  return true;
}

/**
 * Normaliza a resposta para as colunas answerText / answerJson.
 * O tipo da pergunta define o formato: texto livre em `answerText`,
 * escolhas em `answerJson` e o texto de "Outro" preservado em `answerText`.
 */
function normalizeAnswer(question: SnapshotQuestion, answer: AnswerInput) {
  const text = answer.text?.trim() ?? '';

  switch (question.type) {
    case QuestionType.SHORT_TEXT:
    case QuestionType.LONG_TEXT:
    case QuestionType.EMAIL:
    case QuestionType.NUMBER:
      // O texto é guardado como foi digitado, sem truncar.
      return text ? { answerText: text, answerJson: undefined } : null;

    case QuestionType.SINGLE_CHOICE: {
      const value = String(answer.value ?? '');
      if (!value) return null;
      const json = { value } as Prisma.InputJsonValue;
      return { answerText: value === 'other' ? text || null : null, answerJson: json };
    }

    case QuestionType.MULTIPLE_CHOICE: {
      const values = (answer.values ?? []).map(String);
      if (values.length === 0) return null;
      const json = { selected: values } as Prisma.InputJsonValue;
      return { answerText: values.includes('other') ? text || null : null, answerJson: json };
    }

    case QuestionType.YES_NO:
    case QuestionType.SCALE:
    case QuestionType.RATING: {
      const value = answer.value;
      if (value === undefined || value === null || String(value) === '') return null;
      return { answerText: null, answerJson: { value: String(value) } as Prisma.InputJsonValue };
    }

    default:
      return text ? { answerText: text, answerJson: undefined } : null;
  }
}

/**
 * Grava submissão + respostas em uma única transação, garantindo atomicidade
 * e ausência de respostas parciais. A chave de idempotência impede que cliques
 * repetidos ou reenvios de rede criem duas submissões.
 */
export async function saveSubmission(params: {
  formId: string;
  formVersionId: string;
  snapshot: FormSnapshot;
  idempotencyKey: string;
  answers: AnswerInput[];
  durationSeconds?: number | null;
}) {
  const { valid, errors, answers } = validateSubmission(params.snapshot, params.answers);

  if (!valid) {
    throw new AppError(422, 'validation_error', 'Revise as respostas antes de enviar.', errors);
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const submission = await tx.submission.create({
        data: {
          formId: params.formId,
          formVersionId: params.formVersionId,
          idempotencyKey: params.idempotencyKey,
          status: SubmissionStatus.COMPLETED,
          durationSeconds: params.durationSeconds ?? null,
        },
      });

      const questions = await tx.question.findMany({
        where: { formId: params.formId },
        select: { id: true, key: true },
      });
      const idByKey = new Map(questions.map((question) => [question.key, question.id]));

      if (answers.length > 0) {
        await tx.answer.createMany({
          data: answers.map((answer) => ({
            submissionId: submission.id,
            questionId: idByKey.get(answer.questionKey) ?? null,
            questionKey: answer.questionKey,
            answerText: answer.answerText,
            answerJson: answer.answerJson ?? Prisma.DbNull,
          })),
        });
      }

      return submission;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      // Reenvio da mesma submissão: devolve a existente em vez de duplicar.
      const existing = await prisma.submission.findUnique({
        where: { idempotencyKey: params.idempotencyKey },
      });
      if (existing) return { ...existing, duplicate: true };
    }
    throw error;
  }
}

export type { FormVersionSnapshot };