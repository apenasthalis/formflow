/**
 * Cliente HTTP da API.
 *
 * A aplicação é servida atrás do Nginx, então o mesmo origin já publica a API
 * em `/api`. `VITE_API_URL` permite apontar para outro host (por exemplo, ao
 * rodar o Vite fora do Docker).
 */

const BASE_URL = (import.meta.env.VITE_API_URL ?? '/api').replace(/\/$/, '');

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  /** Detalhes de validação por campo, quando a API retorna 422. */
  get fieldErrors(): Record<string, string> {
    if (!Array.isArray(this.details)) return {};
    const errors: Record<string, string> = {};
    for (const item of this.details as { path?: string; message?: string }[]) {
      if (item?.path && item?.message && !errors[item.path]) {
        errors[item.path] = item.message;
      }
    }
    return errors;
  }
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
  /** Resposta bruta (CSV). */
  raw?: boolean;
};

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, signal, raw = false } = options;

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    credentials: 'include',
    headers: {
      Accept: raw ? 'text/csv, */*' : 'application/json',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
  });

  if (raw) {
    if (!response.ok) {
      throw await toApiError(response);
    }
    return (await response.text()) as T;
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const error = payload as { error?: { code?: string; message?: string; details?: unknown } } | null;
    throw new ApiError(
      response.status,
      error?.error?.code ?? 'unknown_error',
      error?.error?.message ?? 'Não foi possível concluir a operação.',
      error?.error?.details,
    );
  }

  return payload as T;
}

async function toApiError(response: Response): Promise<ApiError> {
  const payload = await response.json().catch(() => null);
  const error = payload as { error?: { code?: string; message?: string; details?: unknown } } | null;
  return new ApiError(
    response.status,
    error?.error?.code ?? 'unknown_error',
    error?.error?.message ?? 'Não foi possível concluir a operação.',
    error?.error?.details,
  );
}

/** Monta a query string ignorando valores vazios. */
export function buildQuery(params: Record<string, string | number | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

export const api = {
  get: <T>(path: string, signal?: AbortSignal) => apiRequest<T>(path, { signal }),
  post: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: 'POST', body }),
  patch: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: 'PATCH', body }),
  delete: <T>(path: string) => apiRequest<T>(path, { method: 'DELETE' }),
};