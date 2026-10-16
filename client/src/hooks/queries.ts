import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formsService, resultsService, publicService } from '@/services/api';
import { ApiError } from '@/services/http';
import type { Form, FormStatus, FormSummary, FormAnalytics, PublicForm } from '@/types';

/** Lista de formulários do painel, com busca e filtro de status. */
export function useFormsList(params: { search?: string; status?: FormStatus } = {}) {
  return useQuery({
    queryKey: ['forms', params],
    queryFn: () => formsService.list(params),
  });
}

export function useForm(formId: string | undefined) {
  return useQuery({
    queryKey: ['form', formId],
    queryFn: () => formsService.get(formId as string),
    enabled: Boolean(formId),
  });
}

export type UseAnalyticsParams = { from?: string; to?: string; search?: string };

export function useAnalytics(formId: string | undefined, params: UseAnalyticsParams) {
  return useQuery({
    queryKey: ['analytics', formId, params],
    queryFn: () => resultsService.analytics(formId as string, params),
    enabled: Boolean(formId),
  });
}

export function useSubmissions(
  formId: string | undefined,
  params: UseAnalyticsParams & { page?: number; pageSize?: number },
) {
  return useQuery({
    queryKey: ['submissions', formId, params],
    queryFn: () => resultsService.submissions(formId as string, params),
    enabled: Boolean(formId),
  });
}

export function useSubmission(formId: string | undefined, submissionId: string | undefined) {
  return useQuery({
    queryKey: ['submission', formId, submissionId],
    queryFn: () => resultsService.submission(formId as string, submissionId as string),
    enabled: Boolean(formId) && Boolean(submissionId),
  });
}

/** Formulário público (somente leitura, sem exigir autenticação). */
export function usePublicForm(slug: string | undefined) {
  return useQuery({
    queryKey: ['public-form', slug],
    queryFn: ({ signal }) => publicService.getForm(slug as string, signal),
    enabled: Boolean(slug),
    retry: (failureCount, error) => {
      if (error instanceof ApiError && error.status === 404) return false;
      return failureCount < 2;
    },
    staleTime: 60_000,
  });
}

/** Debounce simples para campos de busca. */
export function useDebounced<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

export type FormsWithSummary = FormSummary[];
export type FormWithQuestions = Form;
export type PublicFormData = PublicForm;
export type AnalyticsData = FormAnalytics;