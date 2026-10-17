import { randomBytes } from 'node:crypto';
import { QuestionType, type Question } from '@prisma/client';
import type { QuestionSettingsInput } from '../schemas/question.js';
import { questionSettingsSchema } from '../schemas/question.js';

/** Identificador curto e legível para perguntas e alternativas. */
export function generateKey(prefix = 'q'): string {
  return `${prefix}_${randomBytes(6).toString('hex')}`;
}

/** Rótulos padrão de cada tipo, usados na criação e na interface. */
export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  [QuestionType.SHORT_TEXT]: 'Texto curto',
  [QuestionType.LONG_TEXT]: 'Texto longo',
  [QuestionType.EMAIL]: 'E-mail',
  [QuestionType.SINGLE_CHOICE]: 'Seleção única',
  [QuestionType.MULTIPLE_CHOICE]: 'Múltipla escolha',
  [QuestionType.YES_NO]: 'Sim ou não',
  [QuestionType.SCALE]: 'Escala numérica',
  [QuestionType.RATING]: 'Avaliação',
};

/** Cria as settings padrão (válidas) para um tipo de pergunta. */
export function defaultSettingsFor(type: QuestionType): QuestionSettingsInput {
  switch (type) {
    case QuestionType.SHORT_TEXT:
      return { type, settings: { placeholder: '', maxLength: 280 } };
    case QuestionType.LONG_TEXT:
      return { type, settings: { placeholder: '', maxLength: 2000 } };
    case QuestionType.EMAIL:
      return { type, settings: { placeholder: '', maxLength: 180 } };
    case QuestionType.SINGLE_CHOICE:
    case QuestionType.MULTIPLE_CHOICE:
      return {
        type,
        settings: {
          options: [
            { value: randomBytes(4).toString('hex'), label: 'Opção 1' },
            { value: randomBytes(4).toString('hex'), label: 'Opção 2' },
          ],
          allowOther: false,
          otherLabel: 'Outro',
          randomizeOptions: false,
        },
      };
    case QuestionType.YES_NO:
      return { type, settings: { yesLabel: 'Sim', noLabel: 'Não' } };
    case QuestionType.SCALE:
      return { type, settings: { min: 0, max: 10, minLabel: '', maxLabel: '' } };
    case QuestionType.RATING:
      return { type, settings: { max: 5, lowLabel: '', highLabel: '' } };
    default:
      return { type: QuestionType.SHORT_TEXT, settings: { placeholder: '', maxLength: 280 } };
  }
}

export function normalizeSettings(type: QuestionType, settings: unknown) {
  return questionSettingsSchema.parse({ type, settings });
}

/** Garante posições contíguas (0..n-1) na ordenação de um conjunto de perguntas. */
export function sortedByPosition<T extends Pick<Question, 'position'>>(questions: T[]): T[] {
  return [...questions].sort((a, b) => a.position - b.position);
}