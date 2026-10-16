import { z } from 'zod';
import { QuestionType } from '@prisma/client';

/** Configurações serializadas dentro do snapshot de uma versão publicada. */
export const snapshotQuestionSchema = z.object({
  id: z.string().uuid(),
  key: z.string().min(1).max(40),
  title: z.string().min(1).max(500),
  description: z.string().nullable(),
  type: z.nativeEnum(QuestionType),
  required: z.boolean(),
  position: z.number().int().min(0),
  settings: z.record(z.unknown()),
  errorMessage: z.string().nullable(),
});

export const formSnapshotSchema = z.object({
  title: z.string().min(1).max(160),
  description: z.string().nullable(),
  welcomeMessage: z.string().nullable(),
  thankYouMessage: z.string().nullable(),
  questions: z.array(snapshotQuestionSchema).max(200),
});

export type FormSnapshot = z.infer<typeof formSnapshotSchema>;
export type SnapshotQuestion = FormSnapshot['questions'][number];

export type FormVersionSnapshot = PrismaFormVersionLike;

type PrismaFormVersionLike = {
  id: string;
  formId: string;
  versionNumber: number;
  snapshot: unknown;
  createdAt: Date;
};

/** Lê e valida o JSONB do snapshot vindo do banco. */
export function parseSnapshot(value: unknown): FormSnapshot {
  return formSnapshotSchema.parse(value);
}