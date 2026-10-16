import { useCallback, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { AlertCircle, WifiOff } from 'lucide-react';
import { FormRunner } from '@/components/runner/FormRunner';
import { Button } from '@/components/ui/button';
import { LoadingState, Spinner } from '@/components/ui/states';
import { Logo } from '@/components/Logo';
import { usePublicForm } from '@/hooks/queries';
import { publicService, type SubmitPayload } from '@/services/api';
import { ApiError } from '@/services/http';
import type { AnswerValue } from '@/types';

/**
 * Página pública de resposta. Não exige autenticação e não expõe nada além do
 * necessário para preencher o formulário.
 */
export function PublicFormPage() {
  const { slug } = useParams<{ slug: string }>();
  const query = usePublicForm(slug);

  useEffect(() => {
    if (!query.data) return;
    const original = document.title;
    document.title = query.data.form.title;
    return () => {
      document.title = original;
    };
  }, [query.data]);

  const submitMutation = useMutation({
    mutationFn: ({ slug, ...payload }: { slug: string } & SubmitPayload) =>
      publicService.submit(slug, payload),
    retry: false,
  });

  const handleSubmit = useCallback(
    async (payload: { answers: AnswerValue[]; idempotencyKey: string; durationSeconds: number }) => {
      if (!slug) return;
      await submitMutation.mutateAsync({
        slug,
        answers: payload.answers,
        idempotencyKey: payload.idempotencyKey,
        durationSeconds: payload.durationSeconds,
      });
    },
    [slug, submitMutation],
  );

  if (query.isLoading) {
    return (
      <FullScreenMessage>
        <LoadingState label="Carregando formulário…" />
      </FullScreenMessage>
    );
  }

  if (query.isError) {
    const notFound = query.error instanceof ApiError && query.error.status === 404;
    return (
      <FullScreenMessage>
        <div className="w-full max-w-md space-y-4 text-center">
          <AlertCircle className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" />
          <h1 className="text-xl font-semibold tracking-tight">
            {notFound ? 'Formulário indisponível' : 'Não foi possível carregar o formulário'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {notFound
              ? 'Este link pode ter sido despublicado, arquivado ou digitado incorretamente.'
              : query.error.message}
          </p>
          <Button variant="outline" onClick={() => void query.refetch()}>
            Tentar novamente
          </Button>
        </div>
      </FullScreenMessage>
    );
  }

  return (
    <div className="min-h-screen">
      {submitMutation.isError ? (
        <div className="flex items-center justify-center gap-2 border-b bg-amber-50 px-4 py-2 text-center text-sm text-amber-800">
          <WifiOff className="h-4 w-4 shrink-0" aria-hidden="true" />
          Não foi possível enviar agora. Suas respostas continuam aqui — tente novamente.
        </div>
      ) : null}

      <div className="mx-auto max-w-3xl px-5 pb-4 pt-6">
        <Logo />
      </div>

      {query.data ? (
        <FormRunner form={query.data.form} onSubmit={handleSubmit} />
      ) : (
        <FullScreenMessage>
          <Spinner />
        </FullScreenMessage>
      )}
    </div>
  );
}

function FullScreenMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen place-items-center px-6">
      <div className="flex w-full flex-col items-center gap-6">
        {children}
        <Logo className="opacity-70" />
      </div>
    </div>
  );
}