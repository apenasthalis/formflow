import type { QuestionType, QuestionSettings } from '@/types';

export const QUESTION_TYPE_LABEL: Record<QuestionType, string> = {
  SHORT_TEXT: 'Texto curto',
  LONG_TEXT: 'Texto longo',
  SINGLE_CHOICE: 'Seleção única',
  MULTIPLE_CHOICE: 'Múltipla escolha',
  YES_NO: 'Sim ou não',
  SCALE: 'Escala numérica',
  RATING: 'Avaliação',
};

export const QUESTION_TYPE_DESCRIPTION: Record<QuestionType, string> = {
  SHORT_TEXT: 'Uma linha de resposta (nome, e-mail, cidade).',
  LONG_TEXT: 'Resposta aberta com várias linhas.',
  SINGLE_CHOICE: 'Uma única alternativa, com avanço automático.',
  MULTIPLE_CHOICE: 'Várias alternativas selecionáveis antes de continuar.',
  YES_NO: 'Resposta binária com rótulos personalizáveis.',
  SCALE: 'Escala numérica entre dois limites.',
  RATING: 'Nota por estrelas ou escala equivalente.',
};

export const FORM_STATUS_LABEL = {
  DRAFT: 'Rascunho',
  PUBLISHED: 'Publicado',
  ARCHIVED: 'Arquivado',
} as const;

export const OTHER_OPTION_VALUE = 'other';

export function makeOptionValue(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Configurações iniciais para um tipo de pergunta (espelha o servidor). */
export function defaultSettingsFor(type: QuestionType): QuestionSettings {
  switch (type) {
    case 'SHORT_TEXT':
      return { placeholder: '', maxLength: 280 };
    case 'LONG_TEXT':
      return { placeholder: '', maxLength: 2000 };
    case 'SINGLE_CHOICE':
    case 'MULTIPLE_CHOICE':
      return {
        options: [
          { value: makeOptionValue(), label: 'Opção 1' },
          { value: makeOptionValue(), label: 'Opção 2' },
        ],
        allowOther: false,
        otherLabel: 'Outro',
        randomizeOptions: false,
      };
    case 'YES_NO':
      return { yesLabel: 'Sim', noLabel: 'Não' };
    case 'SCALE':
      return { min: 0, max: 10, minLabel: '', maxLabel: '' };
    case 'RATING':
      return { max: 5, lowLabel: '', highLabel: '' };
    default:
      return { placeholder: '', maxLength: 280 };
  }
}

export function isChoiceType(type: QuestionType): boolean {
  return type === 'SINGLE_CHOICE' || type === 'MULTIPLE_CHOICE';
}

export function asChoiceSettings(settings: QuestionSettings) {
  return settings as { options: { value: string; label: string }[]; allowOther: boolean; otherLabel: string };
}

export function asTextSettings(settings: QuestionSettings) {
  return settings as { placeholder: string; maxLength: number };
}

export function asScaleSettings(settings: QuestionSettings) {
  return settings as { min: number; max: number; minLabel: string; maxLabel: string };
}

export function asRatingSettings(settings: QuestionSettings) {
  return settings as { max: number; lowLabel: string; highLabel: string };
}

export function asYesNoSettings(settings: QuestionSettings) {
  return settings as { yesLabel: string; noLabel: string };
}

/** Número de colunas da escala numérica no editor e na resposta. */
export function scaleColumns(min: number, max: number): number {
  return Math.min(11, Math.max(2, max - min + 1));
}