import { api, apiRequest, buildQuery, ApiError } from './http';
import type {
  AdminUser,
  AnswerValue,
  Form,
  FormAnalytics,
  FormDetail,
  FormStatus,
  FormSummary,
  PublicForm,
  Question,
  QuestionSettings,
  QuestionType,
  SubmissionDetail,
  SubmissionListResponse,
} from '@/types';

/* ------------------------------- Autenticação ------------------------------ */

export const authService = {
  me: () => api.get<{ user: AdminUser }>('/auth/me'),
  login: (email: string, password: string) =>
    api.post<{ user: AdminUser; expiresAt: string }>('/auth/login', { email, password }),
  logout: () => api.post<void>('/auth/logout'),
  logoutAll: () => api.post<void>('/auth/logout-all'),
};

/* -------------------------------- Formulários ------------------------------ */

export type FormPayload = {
  title?: string;
  description?: string | null;
  slug?: string;
  welcomeMessage?: string | null;
  thankYouMessage?: string | null;
};

export type QuestionPayload = {
  title?: string;
  description?: string | null;
  type?: QuestionType;
  required?: boolean;
  errorMessage?: string | null;
  /** Configurações já validadas no cliente e revalidadas pelo servidor. */
  settings?: QuestionSettings;
};

export const formsService = {
  list: (params: { search?: string; status?: FormStatus } = {}) =>
    api.get<{ forms: FormSummary[] }>(`/forms${buildQuery(params)}`),

  get: (formId: string) => api.get<{ form: FormDetail }>(`/forms/${formId}`),

  create: (payload: FormPayload) => api.post<{ form: Form }>('/forms', payload),

  update: (formId: string, payload: FormPayload) =>
    api.patch<{ form: Form }>(`/forms/${formId}`, payload),

  remove: (formId: string) => api.delete<void>(`/forms/${formId}`),

  duplicate: (formId: string) => api.post<{ form: Form }>(`/forms/${formId}/duplicate`),

  publish: (formId: string) =>
    api.post<{ form: { id: string; status: FormStatus; slug: string; publishedAt: string | null } }>(
      `/forms/${formId}/publish`,
    ),

  unpublish: (formId: string) =>
    api.post<{ form: { id: string; status: FormStatus } }>(`/forms/${formId}/unpublish`),

  archive: (formId: string) =>
    api.post<{ form: { id: string; status: FormStatus } }>(`/forms/${formId}/archive`),
};

/* -------------------------------- Perguntas -------------------------------- */

export const questionsService = {
  create: (formId: string, payload: QuestionPayload & { type: QuestionType }) =>
    api.post<{ question: Question; form: Form }>(`/forms/${formId}/questions`, payload),

  update: (questionId: string, payload: QuestionPayload) =>
    api.patch<{ question: Question }>(`/questions/${questionId}`, payload),

  duplicate: (questionId: string) => api.post<{ question: Question }>(`/questions/${questionId}/duplicate`),

  remove: (questionId: string) => api.delete<void>(`/questions/${questionId}`),

  reorder: (formId: string, questionIds: string[]) =>
    api.post<{ form: Form }>(`/forms/${formId}/questions/reorder`, { questionIds }),
};

/* -------------------------------- Resultados ------------------------------- */

export const resultsService = {
  analytics: (formId: string, params: { from?: string; to?: string; search?: string }) =>
    api.get<{ analytics: FormAnalytics }>(`/forms/${formId}/analytics${buildQuery(params)}`),

  submissions: (
    formId: string,
    params: { page?: number; pageSize?: number; from?: string; to?: string; search?: string },
  ) => api.get<SubmissionListResponse>(`/forms/${formId}/submissions${buildQuery(params)}`),

  submission: (formId: string, submissionId: string) =>
    api.get<{ submission: SubmissionDetail }>(`/forms/${formId}/submissions/${submissionId}`),

  removeSubmission: (formId: string, submissionId: string) =>
    api.delete<void>(`/forms/${formId}/submissions/${submissionId}`),

  exportCsv: (formId: string, params: { from?: string; to?: string }) =>
    apiRequest<string>(`/forms/${formId}/export.csv${buildQuery(params)}`, { raw: true }),
};

/* --------------------------------- Público --------------------------------- */

export type SubmitPayload = {
  idempotencyKey: string;
  answers: AnswerValue[];
  durationSeconds?: number;
};

export const publicService = {
  getForm: (slug: string, signal?: AbortSignal) =>
    api.get<{ form: PublicForm }>(`/public/forms/${encodeURIComponent(slug)}`, signal),

  submit: (slug: string, payload: SubmitPayload) =>
    apiRequest<{ submissionId: string; duplicate: boolean; thankYouMessage: string | null }>(
      `/public/forms/${encodeURIComponent(slug)}/submissions`,
      { method: 'POST', body: payload },
    ),
};

export { ApiError };