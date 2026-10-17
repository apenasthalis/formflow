import { Router } from 'express';
import { z } from 'zod';
import { FormStatus, QuestionType } from '@prisma/client';
import { prisma } from '../utils/prisma.js';
import { AppError } from '../utils/errors.js';
import { publicLimiter, submissionLimiter } from '../middlewares/rateLimit.js';
import { isValidIdempotencyKey } from '../utils/crypto.js';
import { parseSnapshot } from '../schemas/snapshot.js';
import { saveSubmission } from '../services/submissions.service.js';

export const publicRouter = Router();

publicRouter.use(publicLimiter);

const answerSchema = z.object({
  questionKey: z.string().min(1).max(40),
  // Texto livre: sem limite de caracteres. O teto do payload (256 kb no
  // express.json) é o único guard de transporte.
  text: z.string().nullish(),
  value: z.union([z.string().max(200), z.number()]).nullish(),
  values: z.array(z.string().max(200)).max(50).nullish(),
});

const submissionSchema = z.object({
  idempotencyKey: z.string().min(16).max(80),
  durationSeconds: z.number().int().min(0).max(60 * 60 * 12).nullish(),
  answers: z.array(answerSchema).max(300),
});

/** Resposta pública: apenas o necessário para renderizar e responder o formulário. */
publicRouter.get('/forms/:slug', async (req, res, next) => {
  try {
    const slug = z.string().min(1).max(80).parse(req.params.slug);

    const form = await prisma.form.findUnique({
      where: { slug },
      select: {
        id: true,
        slug: true,
        status: true,
        updatedAt: true,
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 1,
          select: { id: true, versionNumber: true, snapshot: true },
        },
      },
    });

    if (!form || form.status !== FormStatus.PUBLISHED || form.versions.length === 0) {
      throw AppError.notFound('Este formulário não está disponível.');
    }

    const version = form.versions[0]!;
    const snapshot = parseSnapshot(version.snapshot);

    res.json({
      form: {
        slug: form.slug,
        versionNumber: version.versionNumber,
        title: snapshot.title,
        description: snapshot.description,
        welcomeMessage: snapshot.welcomeMessage,
        thankYouMessage: snapshot.thankYouMessage,
        questions: snapshot.questions
          .slice()
          .sort((a, b) => a.position - b.position)
          .map((question, index) => ({
            key: question.key,
            position: index,
            title: question.title,
            description: question.description,
            type: question.type,
            required: question.required,
            errorMessage: question.errorMessage,
            settings: question.settings,
          })),
      },
    });
  } catch (error) {
    next(error);
  }
});

publicRouter.post('/forms/:slug/submissions', submissionLimiter, async (req, res, next) => {
  try {
    const slug = z.string().min(1).max(80).parse(req.params.slug);
    const payload = submissionSchema.parse(req.body);

    if (!isValidIdempotencyKey(payload.idempotencyKey)) {
      throw AppError.badRequest('Chave de idempotência inválida.');
    }

    const form = await prisma.form.findUnique({
      where: { slug },
      select: {
        id: true,
        status: true,
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 1,
          select: { id: true, snapshot: true },
        },
      },
    });

    if (!form || form.status !== FormStatus.PUBLISHED || form.versions.length === 0) {
      throw AppError.notFound('Este formulário não está disponível.');
    }

    const version = form.versions[0]!;
    const snapshot = parseSnapshot(version.snapshot);

    const submission = await saveSubmission({
      formId: form.id,
      formVersionId: version.id,
      snapshot,
      idempotencyKey: payload.idempotencyKey,
      answers: payload.answers,
      durationSeconds: payload.durationSeconds ?? null,
    });

    res.status(201).json({
      submissionId: submission.id,
      duplicate: 'duplicate' in submission ? true : false,
      thankYouMessage: snapshot.thankYouMessage,
    });
  } catch (error) {
    next(error);
  }
});