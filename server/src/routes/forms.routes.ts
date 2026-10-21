import { Router } from 'express';
import { z } from 'zod';
import { FormStatus, Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma.js';
import { AppError } from '../utils/errors.js';
import { apiLimiter } from '../middlewares/rateLimit.js';
import { requireAuth, requireOwnedForm } from '../middlewares/auth.js';
import {
  assertValidSlug,
  duplicateForm,
  findOwnedForm,
  generateUniqueSlug,
  hasUnpublishedChanges,
  publishForm,
  resequencePositions,
  unpublishForm,
} from '../services/forms.service.js';
import { defaultSettingsFor, generateKey, normalizeSettings } from '../utils/questions.js';
import { questionPayloadSchema, questionUpdateSchema } from '../schemas/question.js';
import {
  exportSubmissionsCsv,
} from '../services/export.service.js';
import { getFormAnalytics, getSubmission, listSubmissions } from '../services/analytics.service.js';
import { routeId } from '../utils/request.js';

export const formsRouter = Router();

formsRouter.use(apiLimiter, requireAuth);

const formPayloadSchema = z.object({
  title: z.string().trim().min(1, 'Informe um título.').max(160),
  description: z.string().trim().max(2000).nullish(),
  slug: z.string().trim().min(1).max(80).optional(),
  welcomeMessage: z.string().trim().max(600).nullish(),
  thankYouMessage: z.string().trim().max(600).nullish(),
});

const questionInclude = { questions: { orderBy: { position: 'asc' } } } as const;

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

function dateRange(query: unknown) {
  const parsed = z
    .object({ from: z.string().optional(), to: z.string().optional() })
    .parse(query ?? {});
  const from = parsed.from ? new Date(parsed.from) : undefined;
  const to = parsed.to ? new Date(parsed.to) : undefined;
  if (from && Number.isNaN(from.getTime())) throw AppError.badRequest('Data inicial inválida.');
  if (to && Number.isNaN(to.getTime())) throw AppError.badRequest('Data final inválida.');
  // "to" inclui o dia inteiro informado.
  if (to) to.setUTCHours(23, 59, 59, 999);
  return { from, to };
}

function serializeForm(form: {
  id: string;
  title: string;
  description: string | null;
  slug: string;
  status: FormStatus;
  welcomeMessage: string | null;
  thankYouMessage: string | null;
  ownerId: string;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  questions?: unknown[];
}) {
  return {
    id: form.id,
    title: form.title,
    description: form.description,
    slug: form.slug,
    status: form.status,
    welcomeMessage: form.welcomeMessage,
    thankYouMessage: form.thankYouMessage,
    publishedAt: form.publishedAt?.toISOString() ?? null,
    createdAt: form.createdAt.toISOString(),
    updatedAt: form.updatedAt.toISOString(),
    questions: form.questions ?? [],
  };
}

// ---------------------------------------------------------------------------
// Coleção de formulários
// ---------------------------------------------------------------------------

formsRouter.get('/', async (req, res, next) => {
  try {
    const ownerId = req.user!.id;
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;

    const where: Prisma.FormWhereInput = {
      ownerId,
      ...(status && Object.values(FormStatus).includes(status as FormStatus)
        ? { status: status as FormStatus }
        : {}),
      ...(search ? { title: { contains: search, mode: 'insensitive' } } : {}),
    };

    const forms = await prisma.form.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: {
        questions: { orderBy: { position: 'asc' }, select: { id: true } },
        _count: { select: { submissions: true } },
      },
    });

    res.json({
      forms: forms.map((form) => ({
        ...serializeForm(form),
        questionCount: form.questions.length,
        submissionCount: form._count.submissions,
      })),
    });
  } catch (error) {
    next(error);
  }
});

formsRouter.post('/', async (req, res, next) => {
  try {
    const payload = formPayloadSchema.parse(req.body);
    const ownerId = req.user!.id;

    const slug = payload.slug
      ? assertValidSlug(payload.slug)
      : await generateUniqueSlug(payload.title);

    const form = await prisma.form.create({
      data: {
        title: payload.title,
        description: payload.description ?? null,
        slug,
        welcomeMessage: payload.welcomeMessage ?? null,
        thankYouMessage: payload.thankYouMessage ?? null,
        ownerId,
      },
      include: questionInclude,
    });

    res.status(201).json({ form: serializeForm(form) });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// Formulário individual
// ---------------------------------------------------------------------------

formsRouter.get('/:id', requireOwnedForm, async (req, res, next) => {
  try {
    const form = await findOwnedForm(routeId(req), req.user!.id);

    const [submissionCount, versionCount, lastVersion] = await Promise.all([
      prisma.submission.count({ where: { formId: form.id } }),
      prisma.formVersion.count({ where: { formId: form.id } }),
      prisma.formVersion.findFirst({
        where: { formId: form.id },
        orderBy: { versionNumber: 'desc' },
        select: { versionNumber: true, snapshot: true },
      }),
    ]);

    res.json({
      form: {
        ...serializeForm(form),
        submissionCount,
        versionCount,
        publishedVersionNumber: lastVersion?.versionNumber ?? null,
        hasUnpublishedChanges:
          form.status === FormStatus.PUBLISHED &&
          hasUnpublishedChanges(form, form.questions, lastVersion),
      },
    });
  } catch (error) {
    next(error);
  }
});

formsRouter.patch('/:id', requireOwnedForm, async (req, res, next) => {
  try {
    const payload = formPayloadSchema.partial().parse(req.body);
    const ownerId = req.user!.id;
    const current = await findOwnedForm(routeId(req), ownerId);

    const data: Prisma.FormUpdateInput = {};
    if (payload.title !== undefined) data.title = payload.title;
    if (payload.description !== undefined) data.description = payload.description ?? null;
    if (payload.welcomeMessage !== undefined) data.welcomeMessage = payload.welcomeMessage ?? null;
    if (payload.thankYouMessage !== undefined) data.thankYouMessage = payload.thankYouMessage ?? null;
    if (payload.slug !== undefined && payload.slug !== current.slug) {
      data.slug = assertValidSlug(payload.slug);
    }

    const form = await prisma.form.update({
      where: { id: current.id },
      data,
      include: { questions: { orderBy: { position: 'asc' } } },
    });

    res.json({ form: serializeForm(form) });
  } catch (error) {
    next(error);
  }
});

formsRouter.delete('/:id', requireOwnedForm, async (req, res, next) => {
  try {
    await prisma.form.delete({ where: { id: routeId(req) } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

formsRouter.post('/:id/duplicate', requireOwnedForm, async (req, res, next) => {
  try {
    const { form, questions } = await duplicateForm(routeId(req), req.user!.id);
    res.status(201).json({ form: { ...serializeForm(form), questions } });
  } catch (error) {
    next(error);
  }
});

formsRouter.post('/:id/publish', requireOwnedForm, async (req, res, next) => {
  try {
    const form = await publishForm(routeId(req), req.user!.id);
    // O slug volta na resposta para o painel confirmar qual link foi publicado:
    // publicar reutiliza o endereço já definido no editor.
    res.json({
      form: {
        id: form.id,
        status: form.status,
        slug: form.slug,
        publishedAt: form.publishedAt?.toISOString() ?? null,
      },
    });
  } catch (error) {
    next(error);
  }
});

formsRouter.post('/:id/unpublish', requireOwnedForm, async (req, res, next) => {
  try {
    const form = await unpublishForm(routeId(req), req.user!.id);
    res.json({ form: { id: form.id, status: form.status } });
  } catch (error) {
    next(error);
  }
});

formsRouter.post('/:id/archive', requireOwnedForm, async (req, res, next) => {
  try {
    const form = await prisma.form.update({
      where: { id: routeId(req) },
      data: { status: FormStatus.ARCHIVED },
    });
    res.json({ form: { id: form.id, status: form.status } });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// Perguntas
// ---------------------------------------------------------------------------

formsRouter.post('/:id/questions', requireOwnedForm, async (req, res, next) => {
  try {
    const formId = routeId(req);
    await findOwnedForm(formId, req.user!.id);

    const payload = questionPayloadSchema.parse(req.body);
    const settings = normalizeSettings(payload.type, payload.settings);

    const last = await prisma.question.findFirst({
      where: { formId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });

    const question = await prisma.question.create({
      data: {
        formId,
        key: generateKey(),
        title: payload.title,
        description: payload.description ?? null,
        type: payload.type,
        required: payload.required,
        errorMessage: payload.errorMessage ?? null,
        settings: settings.settings as Prisma.InputJsonValue,
        position: (last?.position ?? -1) + 1,
      },
    });

    const form = await prisma.form.findUniqueOrThrow({
      where: { id: formId },
      include: questionInclude,
    });

    res.status(201).json({ question, form: serializeForm(form) });
  } catch (error) {
    next(error);
  }
});

formsRouter.post('/:id/questions/reorder', requireOwnedForm, async (req, res, next) => {
  try {
    const formId = routeId(req);
    await findOwnedForm(formId, req.user!.id);

    const payload = z
      .object({ questionIds: z.array(z.string().uuid()).min(1).max(500) })
      .parse(req.body);

    const existing = await prisma.question.findMany({
      where: { formId },
      select: { id: true },
    });
    const existingIds = new Set(existing.map((question) => question.id));
    const received = new Set(payload.questionIds);

    if (received.size !== payload.questionIds.length) {
      throw AppError.badRequest('A lista de perguntas contém identificadores repetidos.');
    }
    for (const id of payload.questionIds) {
      if (!existingIds.has(id)) throw AppError.badRequest('Pergunta inválida na reordenação.');
    }
    if (received.size !== existing.length) {
      throw AppError.badRequest('A reordenação deve incluir todas as perguntas do formulário.');
    }

    // Ordenação posicional única evita violar a restrição (formId, position).
    await prisma.$transaction(async (tx) => {
      for (const [index, id] of payload.questionIds.entries()) {
        await tx.question.update({ where: { id }, data: { position: 10_000 + index } });
      }
      for (const [index, id] of payload.questionIds.entries()) {
        await tx.question.update({ where: { id }, data: { position: index } });
      }
    });

    const form = await prisma.form.findUniqueOrThrow({
      where: { id: formId },
      include: questionInclude,
    });

    res.json({ form: serializeForm(form) });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// Resultados
// ---------------------------------------------------------------------------

formsRouter.get('/:id/analytics', requireOwnedForm, async (req, res, next) => {
  try {
    const { from, to } = dateRange(req.query);
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : undefined;
    const analytics = await getFormAnalytics(routeId(req), req.user!.id, { from, to, search });
    res.json({ analytics });
  } catch (error) {
    next(error);
  }
});

formsRouter.get('/:id/submissions', requireOwnedForm, async (req, res, next) => {
  try {
    const pagination = paginationSchema.parse(req.query);
    const { from, to } = dateRange(req.query);
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : undefined;

    const result = await listSubmissions(routeId(req), req.user!.id, {
      ...pagination,
      from,
      to,
      search,
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

formsRouter.get('/:id/submissions/:submissionId', requireOwnedForm, async (req, res, next) => {
  try {
    const submission = await getSubmission(routeId(req), routeId(req, 'submissionId'), req.user!.id);
    res.json({ submission });
  } catch (error) {
    next(error);
  }
});

formsRouter.delete('/:id/submissions/:submissionId', requireOwnedForm, async (req, res, next) => {
  try {
    const formId = routeId(req);
    const submissionId = routeId(req, 'submissionId');
    const submission = await prisma.submission.findFirst({ where: { id: submissionId, formId } });
    if (!submission) throw AppError.notFound('Resposta não encontrada.');
    await prisma.submission.delete({ where: { id: submissionId } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

formsRouter.get('/:id/export.csv', requireOwnedForm, async (req, res, next) => {
  try {
    const { from, to } = dateRange(req.query);
    const csv = await exportSubmissionsCsv(routeId(req), req.user!.id, { from, to });

    const form = await findOwnedForm(routeId(req), req.user!.id);
    const filename = `${form.slug}-respostas.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(`﻿${csv}`);
  } catch (error) {
    next(error);
  }
});

export const questionsRouter = Router();

questionsRouter.use(apiLimiter, requireAuth);

questionsRouter.patch('/:id', async (req, res, next) => {
  try {
    const ownerId = req.user!.id;
    const question = await prisma.question.findUnique({
      where: { id: routeId(req) },
      include: { form: { select: { id: true, ownerId: true } } },
    });
    if (!question || question.form.ownerId !== ownerId) {
      throw AppError.notFound('Pergunta não encontrada.');
    }

    const payload = questionUpdateSchema.parse(req.body);
    const type = payload.type ?? question.type;
    // As configurações são específicas do tipo. Ao trocar o tipo sem mandá-las
    // (API), o novo tipo entra com as configurações padrão em vez de recusar
    // um payload que era válido para o tipo anterior.
    const settings =
      payload.settings !== undefined
        ? normalizeSettings(type, payload.settings)
        : payload.type !== undefined && payload.type !== question.type
          ? normalizeSettings(type, defaultSettingsFor(type).settings)
          : normalizeSettings(type, question.settings as Record<string, unknown>);

    const updated = await prisma.question.update({
      where: { id: question.id },
      data: {
        ...(payload.title !== undefined ? { title: payload.title } : {}),
        ...(payload.description !== undefined ? { description: payload.description ?? null } : {}),
        ...(payload.type !== undefined ? { type: payload.type } : {}),
        ...(payload.required !== undefined ? { required: payload.required } : {}),
        ...(payload.errorMessage !== undefined ? { errorMessage: payload.errorMessage ?? null } : {}),
        settings: settings.settings as Prisma.InputJsonValue,
      },
    });

    res.json({ question: updated });
  } catch (error) {
    next(error);
  }
});

questionsRouter.post('/:id/duplicate', async (req, res, next) => {
  try {
    const ownerId = req.user!.id;
    const question = await prisma.question.findUnique({
      where: { id: routeId(req) },
      include: { form: { select: { id: true, ownerId: true } } },
    });
    if (!question || question.form.ownerId !== ownerId) {
      throw AppError.notFound('Pergunta não encontrada.');
    }

    const last = await prisma.question.findFirst({
      where: { formId: question.formId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });

    const copy = await prisma.question.create({
      data: {
        formId: question.formId,
        key: generateKey(),
        title: `${question.title} (cópia)`,
        description: question.description,
        type: question.type,
        required: question.required,
        errorMessage: question.errorMessage,
        settings: question.settings as Prisma.InputJsonValue,
        position: (last?.position ?? -1) + 1,
      },
    });

    res.status(201).json({ question: copy });
  } catch (error) {
    next(error);
  }
});

questionsRouter.delete('/:id', async (req, res, next) => {
  try {
    const ownerId = req.user!.id;
    const question = await prisma.question.findUnique({
      where: { id: routeId(req) },
      include: { form: { select: { id: true, ownerId: true } } },
    });
    if (!question || question.form.ownerId !== ownerId) {
      throw AppError.notFound('Pergunta não encontrada.');
    }

    await prisma.question.delete({ where: { id: question.id } });
    await resequencePositions(question.formId);

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});