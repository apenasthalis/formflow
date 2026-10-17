import { z } from 'zod';
import { QuestionType } from '@prisma/client';

/** Alternativa de escolha (múltipla escolha / sim ou não / "outro"). */
export const choiceOptionSchema = z.object({
  /** Identificador estável da alternativa dentro da pergunta. */
  value: z.string().min(1).max(80),
  label: z.string().min(1, 'A alternativa precisa de um texto').max(200),
});

export const yesNoLabelsSchema = z.object({
  yesLabel: z.string().max(60).default('Sim'),
  noLabel: z.string().max(60).default('Não'),
});

export const scaleSettingsSchema = z
  .object({
    min: z.coerce.number().int().min(0).max(100).default(0),
    max: z.coerce.number().int().min(1).max(101).default(10),
    minLabel: z.string().max(60).default(''),
    maxLabel: z.string().max(60).default(''),
  })
  .refine((value) => value.max > value.min, {
    message: 'O valor máximo deve ser maior que o mínimo.',
    path: ['max'],
  });

export const ratingSettingsSchema = z.object({
  max: z.coerce.number().int().min(3).max(10).default(5),
  lowLabel: z.string().max(60).default(''),
  highLabel: z.string().max(60).default(''),
});

/**
 * Campos de texto livre: sem limite de caracteres. A única regra é não enviar
 * resposta vazia, e ela vale apenas para perguntas obrigatórias.
 */
export const textSettingsSchema = z.object({
  placeholder: z.string().max(200).default(''),
});

export const emailSettingsSchema = textSettingsSchema;

export const numberSettingsSchema = textSettingsSchema;

/** Formato aceito para a resposta de uma pergunta do tipo e-mail. */
export const emailAnswerSchema = z
  .string()
  .trim()
  .min(1, 'Informe um e-mail válido.')
  .max(320, 'Informe um e-mail válido.')
  .email('Informe um e-mail válido.');

export const choiceSettingsSchema = z.object({
  options: z.array(choiceOptionSchema).min(1, 'Adicione ao menos uma alternativa').max(30),
  /** Exibe o campo "Outro" com texto livre. */
  allowOther: z.boolean().default(false),
  otherLabel: z.string().max(60).default('Outro'),
  /** Rótulos exibidos no lugar das letras (A, B, C...). */
  randomizeOptions: z.boolean().default(false),
});

/** Discriminado por tipo: valida apenas as settings relevantes. */
export const questionSettingsSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal(QuestionType.SHORT_TEXT), settings: textSettingsSchema }),
  z.object({ type: z.literal(QuestionType.LONG_TEXT), settings: textSettingsSchema }),
  z.object({ type: z.literal(QuestionType.EMAIL), settings: emailSettingsSchema }),
  z.object({ type: z.literal(QuestionType.NUMBER), settings: numberSettingsSchema }),
  z.object({ type: z.literal(QuestionType.SINGLE_CHOICE), settings: choiceSettingsSchema }),
  z.object({ type: z.literal(QuestionType.MULTIPLE_CHOICE), settings: choiceSettingsSchema }),
  z.object({ type: z.literal(QuestionType.YES_NO), settings: yesNoLabelsSchema }),
  z.object({ type: z.literal(QuestionType.SCALE), settings: scaleSettingsSchema }),
  z.object({ type: z.literal(QuestionType.RATING), settings: ratingSettingsSchema }),
]);

/**
 * Campos comuns de uma pergunta (usados tanto na criação quanto na edição).
 *
 * O enunciado pode ficar vazio durante a edição — a exigência de um enunciado
 * acontece na publicação, quando o formulário deixa de ser um rascunho.
 */
export const questionBaseSchema = z.object({
  title: z.string().trim().max(500).default(''),
  description: z.string().trim().max(1000).nullish(),
  type: z.nativeEnum(QuestionType),
  required: z.boolean().default(false),
  errorMessage: z.string().trim().max(300).nullish(),
  settings: z.record(z.unknown()).default({}),
});

/** Schema do payload de pergunta usado no endpoint de criação. */
export const questionPayloadSchema = questionBaseSchema.superRefine((value, ctx) => {
  const result = questionSettingsSchema.safeParse({ type: value.type, settings: value.settings });
  if (!result.success) {
    for (const issue of result.error.issues) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['settings', ...issue.path],
        message: issue.message,
      });
    }
  }
});

/**
 * Schema do endpoint de atualização: todos os campos são opcionais.
 * As configurações são validadas no serviço, já combinadas com o tipo atual.
 */
export const questionUpdateSchema = questionBaseSchema.partial();

export type QuestionSettingsInput = z.input<typeof questionSettingsSchema>;