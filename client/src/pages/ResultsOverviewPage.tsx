import { Link } from 'react-router-dom';
import { BarChart3, Inbox, MessageSquareQuote } from 'lucide-react';
import { PageHeader } from '@/layouts/AdminLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FormStatusBadge } from '@/components/FormStatusBadge';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { useFormsList } from '@/hooks/queries';
import { formatNumber, formatRelative } from '@/utils/format';

/**
 * Visão geral dos resultados: lista os formulários que já receberam respostas
 * e permite entrar no detalhe de cada um.
 */
export function ResultsOverviewPage() {
  const query = useFormsList();
  const forms = query.data?.forms ?? [];
  const withResponses = forms.filter((form) => form.submissionCount > 0);

  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader
        title="Resultados"
        description="Escolha um formulário para ver a distribuição das respostas, filtrar por período e exportar para CSV."
      />

      <div className="flex-1 space-y-4 p-4 sm:p-6">
        {query.isLoading ? <LoadingState label="Carregando formulários…" /> : null}

        {query.isError ? (
          <ErrorState description={query.error.message} onRetry={() => void query.refetch()} />
        ) : null}

        {query.isSuccess && withResponses.length === 0 ? (
          <EmptyState
            icon={<MessageSquareQuote className="h-5 w-5" />}
            title="Nenhuma resposta recebida ainda"
            description="Publie um formulário e compartilhe o link para começar a receber respostas."
            action={
              <Button asChild>
                <Link to="/">Ir para os formulários</Link>
              </Button>
            }
          />
        ) : null}

        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {withResponses.map((form) => (
            <li key={form.id}>
              <Link
                to={`/resultados/${form.id}`}
                className="flex h-full flex-col rounded-xl border bg-card p-5 transition-colors hover:border-foreground/20"
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="min-w-0 flex-1 truncate text-[15px] font-semibold">
                    {form.title}
                  </h2>
                  <FormStatusBadge status={form.status} />
                </div>

                <p className="mt-3 flex items-baseline gap-1.5">
                  <span className="text-2xl font-semibold tracking-tight">
                    {formatNumber(form.submissionCount)}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {form.submissionCount === 1 ? 'resposta' : 'respostas'}
                  </span>
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Badge variant="outline">
                    {form.questionCount} {form.questionCount === 1 ? 'pergunta' : 'perguntas'}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    Atualizado {formatRelative(form.updatedAt)}
                  </span>
                </div>

                <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
                  <BarChart3 className="h-4 w-4" aria-hidden="true" />
                  Ver análise
                </span>
              </Link>
            </li>
          ))}
        </ul>

        {query.isSuccess && forms.length > 0 && withResponses.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Inbox className="h-4 w-4" aria-hidden="true" />
            Você tem {forms.length} formulário(s) aguardando a primeira resposta.
          </p>
        ) : null}
      </div>
    </div>
  );
}