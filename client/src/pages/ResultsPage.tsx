import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  Inbox,
  ListFilter,
  Pencil,
  Search,
  Star,
  Trash2,
} from 'lucide-react';
import { PageHeader } from '@/layouts/AdminLayout';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { FormStatusBadge } from '@/components/FormStatusBadge';
import { EmptyState, ErrorState, LoadingState, Spinner } from '@/components/ui/states';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/components/ui/toast';
import { useAnalytics, useDebounced, useForm, useSubmissions } from '@/hooks/queries';
import { resultsService } from '@/services/api';
import {
  formatDateTime,
  formatDuration,
  formatNumber,
  formatPercentage,
} from '@/utils/format';
import { QUESTION_TYPE_LABEL } from '@/utils/questions';
import type {
  QuestionAnalytics,
  QuestionSettings,
  QuestionType,
  SubmissionListItem,
} from '@/types';

export function ResultsPage() {
  const { formId } = useParams<{ formId: string }>();
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounced(search);
  const queryClient = useQueryClient();
  const [pendingDeleteSubmission, setPendingDeleteSubmission] = useState<SubmissionListItem | null>(null);

  const filters = useMemo(
    () => ({ from: from || undefined, to: to || undefined, search: debouncedSearch || undefined }),
    [from, to, debouncedSearch],
  );

  const formQuery = useForm(formId);
  const analyticsQuery = useAnalytics(formId, filters);
  const submissionsQuery = useSubmissions(formId, { ...filters, page, pageSize: 20 });

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, from, to]);

  const exportMutation = useMutation({
    mutationFn: () => resultsService.exportCsv(formId as string, { from: from || undefined, to: to || undefined }),
    onSuccess: (csv) => {
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${formQuery.data?.form.slug ?? 'formulario'}-respostas.csv`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success('Arquivo CSV gerado.');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteSubmissionMutation = useMutation({
    mutationFn: (submissionId: string) =>
      resultsService.removeSubmission(formId as string, submissionId),
    onSuccess: () => {
      setPendingDeleteSubmission(null);
      void queryClient.invalidateQueries({ queryKey: ['submissions', formId] });
      void queryClient.invalidateQueries({ queryKey: ['analytics', formId] });
      toast.success('Resposta excluída.');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (formQuery.isLoading) return <LoadingState label="Carregando formulário…" />;

  if (formQuery.isError || !formQuery.data) {
    return (
      <div className="p-6">
        <ErrorState
          title="Formulário não encontrado"
          description={formQuery.error?.message}
          onRetry={() => void formQuery.refetch()}
        />
      </div>
    );
  }

  const form = formQuery.data.form;
  const analytics = analyticsQuery.data?.analytics;
  const hasResponses = (analytics?.totalSubmissions ?? 0) > 0;

  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            {form.title}
            <FormStatusBadge status={form.status} />
          </span>
        }
        description={form.description ?? 'Resultados coletados pela página pública.'}
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <Link to={`/formularios/${form.id}/editar`}>
                <Pencil className="h-4 w-4" aria-hidden="true" />
                Editar
              </Link>
            </Button>
            {form.status === 'PUBLISHED' ? (
              <Button variant="ghost" size="sm" asChild>
                <a href={`/f/${form.slug}`} target="_blank" rel="noreferrer noopener">
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  Abrir link
                </a>
              </Button>
            ) : null}
            <Button
              size="sm"
              onClick={() => exportMutation.mutate()}
              disabled={exportMutation.isPending || !hasResponses}
            >
              {exportMutation.isPending ? (
                <Spinner />
              ) : (
                <Download className="h-4 w-4" aria-hidden="true" />
              )}
              Exportar CSV
            </Button>
          </>
        }
      />

      <div className="space-y-4 border-b bg-background px-4 py-3 sm:px-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative w-full sm:max-w-xs">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar nas respostas"
              aria-label="Buscar nas respostas"
              className="pl-9"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <Input
                type="date"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
                aria-label="Filtrar a partir de"
                className="h-9 w-[9.5rem]"
              />
            </div>
            <span className="text-xs text-muted-foreground">até</span>
            <Input
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              aria-label="Filtrar até"
              className="h-9 w-[9.5rem]"
            />
            {from || to || search ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFrom('');
                  setTo('');
                  setSearch('');
                }}
              >
                Limpar
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-6 p-4 sm:p-6">
        {analyticsQuery.isLoading ? <LoadingState label="Carregando resultados…" /> : null}
        {analyticsQuery.isError ? (
          <ErrorState
            description={analyticsQuery.error.message}
            onRetry={() => void analyticsQuery.refetch()}
          />
        ) : null}

        {analytics ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="Respostas" value={formatNumber(analytics.totalSubmissions)} />
              <MetricCard
                label="Taxa de conclusão"
                value={formatPercentage(analytics.completionRate)}
                hint="Submissões que responderam todas as perguntas obrigatórias."
              />
              <MetricCard
                label="Última resposta"
                value={analytics.lastSubmissionAt ? formatDateTime(analytics.lastSubmissionAt) : '—'}
              />
              <MetricCard
                label="Tempo médio"
                value={formatDuration(analytics.averageDurationSeconds)}
                hint="Calculado a partir de quem preencheu o formulário inteiro."
              />
            </div>

            {!hasResponses ? (
              <EmptyState
                icon={<Inbox className="h-5 w-5" />}
                title="Ainda não há respostas"
                description={
                  form.status === 'PUBLISHED'
                    ? 'Compartilhe o link público para começar a receber respostas.'
                    : 'Publie o formulário para que ele aceite respostas.'
                }
                action={
                  form.status === 'PUBLISHED' ? (
                    <Button variant="outline" asChild>
                      <a href={`/f/${form.slug}`} target="_blank" rel="noreferrer noopener">
                        <ExternalLink className="h-4 w-4" aria-hidden="true" />
                        Abrir página pública
                      </a>
                    </Button>
                  ) : (
                    <Button asChild>
                      <Link to={`/formularios/${form.id}/editar`}>Publicar formulário</Link>
                    </Button>
                  )
                }
              />
            ) : null}

            {hasResponses ? (
              <Tabs defaultValue="respostas">
                <div className="flex items-center justify-between gap-4">
                  <TabsList>
                    <TabsTrigger value="respostas">
                      <ListFilter className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                      Submissões
                    </TabsTrigger>
                    <TabsTrigger value="perguntas">Por pergunta</TabsTrigger>
                  </TabsList>
                  <p className="text-xs text-muted-foreground">
                    {analytics.submissionsInPeriod} resposta(s) no período selecionado
                  </p>
                </div>

                <TabsContent value="respostas">
                  {submissionsQuery.isLoading ? <LoadingState /> : null}
                  {submissionsQuery.isError ? (
                    <ErrorState
                      description={submissionsQuery.error.message}
                      onRetry={() => void submissionsQuery.refetch()}
                    />
                  ) : null}
                  {submissionsQuery.data ? (
                    <SubmissionTable
                      submissions={submissionsQuery.data.submissions}
                      formId={form.id as string}
                      onDelete={(submission) => setPendingDeleteSubmission(submission)}
                      total={submissionsQuery.data.total}
                      page={submissionsQuery.data.page}
                      pageCount={submissionsQuery.data.pageCount}
                      onPageChange={setPage}
                      // As respostas são casadas pela chave estável da pergunta
                      // (a mesma preservada entre versões do formulário).
                      questions={form.questions.map((question) => ({
                        key: question.key,
                        title: question.title,
                        type: question.type,
                        settings: question.settings,
                      }))}
                    />
                  ) : null}
                </TabsContent>

                <TabsContent value="perguntas">
                  <div className="space-y-4">
                    {analytics.questions.length === 0 ? (
                      <EmptyState
                        title="Este formulário ainda não tem perguntas publicadas"
                        description="Publique o formulário para começar a coletar respostas."
                      />
                    ) : (
                      analytics.questions.map((question) => (
                        <QuestionAnalyticsCard key={question.key} question={question} formId={form.id as string} />
                      ))
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            ) : null}
          </>
        ) : null}
      </div>

      {submissionsQuery.isFetching && !submissionsQuery.isLoading ? (
        <div className="pointer-events-none fixed bottom-4 right-4">
          <Badge variant="secondary" className="gap-1.5">
            <Spinner /> Atualizando
          </Badge>
        </div>
      ) : null}

      <AlertDialog
        open={Boolean(pendingDeleteSubmission)}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteSubmission(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir esta resposta?</AlertDialogTitle>
            <AlertDialogDescription>
              A resposta selecionada será removida permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteSubmissionMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteSubmissionMutation.isPending}
              onClick={() => {
                if (pendingDeleteSubmission) deleteSubmissionMutation.mutate(pendingDeleteSubmission.id);
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function MetricCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
      {hint ? <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

type AnalyticQuestionView = {
  key: string;
  title: string;
  type: QuestionType;
  settings: QuestionSettings;
};

function SubmissionTable({
  submissions,
  formId,
  total,
  page,
  pageCount,
  onPageChange,
  questions,
  onDelete,
}: {
  submissions: SubmissionListItem[];
  formId: string;
  total: number;
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  questions: AnalyticQuestionView[];
  onDelete: (submission: SubmissionListItem) => void;
}) {
  if (submissions.length === 0) {
    return (
      <EmptyState
        title="Nenhuma resposta encontrada"
        description="Ajuste o período ou a busca para ampliar os resultados."
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left">
              <th scope="col" className="w-[190px] px-4 py-3 font-medium">Data e hora</th>
              {questions.slice(0, 3).map((question) => (
                <th key={question.key} scope="col" className="px-4 py-3 font-medium">
                  <span className="line-clamp-2">{question.title}</span>
                </th>
              ))}
              <th scope="col" className="px-4 py-3 text-right font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {submissions.map((submission) => (
              <tr key={submission.id} className="border-b last:border-0 hover:bg-muted/30">
                <td className="px-4 py-3 align-top">
                  <p>{formatDateTime(submission.submittedAt)}</p>
                  <p className="text-xs text-muted-foreground">
                    v{submission.versionNumber} · {formatDuration(submission.durationSeconds)}
                  </p>
                </td>
                {questions.slice(0, 3).map((question) => (
                  <td key={question.key} className="px-4 py-3 align-top">
                    <p className="line-clamp-2 text-muted-foreground">
                      {formatAnswer(
                        submission.answers.find((answer) => answer.questionKey === question.key),
                        question,
                      )}
                    </p>
                  </td>
                ))}
                <td className="px-4 py-3 text-right align-top">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="sm" asChild>
                      <Link to={`/resultados/${formId}/${submission.id}`}>Ver</Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDelete(submission)}
                      aria-label="Excluir resposta"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Página {page} de {pageCount} · {total} resposta(s)
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            Anterior
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= pageCount}
            onClick={() => onPageChange(page + 1)}
          >
            Próxima
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function QuestionAnalyticsCard({
  question,
  formId,
}: {
  question: QuestionAnalytics;
  formId: string;
}) {
  const max = Math.max(1, ...question.distribution.map((bucket) => bucket.count), ...(question.scale?.histogram.map((bucket) => bucket.count) ?? [1]));

  return (
    <article className="rounded-xl border bg-card p-5">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-[15px] font-semibold">{question.title}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {QUESTION_TYPE_LABEL[question.type]} · {question.answeredCount} resposta(s)
            {question.skippedCount > 0 ? ` · ${question.skippedCount} ignorada(s)` : ''}
          </p>
        </div>
        {question.required ? <Badge variant="outline">Obrigatória</Badge> : null}
      </header>

      {question.distribution.length > 0 ? (
        <ul className="mt-5 space-y-3">
          {question.distribution.map((bucket) => (
            <li key={bucket.value} className="space-y-1.5">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate">{bucket.label}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatNumber(bucket.count)} · {formatPercentage(bucket.percentage)}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${(bucket.count / max) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {question.scale ? (
        <div className="mt-5">
          <p className="text-sm text-muted-foreground">
            Média: <span className="font-medium text-foreground">{question.scale.average ?? '—'}</span>{' '}
            (de {question.scale.min} a {question.scale.max})
          </p>
          <div className="mt-3 flex items-end gap-1.5" style={{ height: 96 }}>
            {question.scale.histogram.map((bucket) => (
              <div key={bucket.value} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-[10px] text-muted-foreground">{bucket.count || ''}</span>
                <div
                  className="w-full rounded-t bg-primary/80"
                  style={{ height: `${(bucket.count / max) * 100}%`, minHeight: bucket.count ? 4 : 1 }}
                />
                <span className="text-[10px] text-muted-foreground">{bucket.label}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {question.textTotalCount > 0 ? (
        <div className="mt-5 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            {question.textSamples.length} de {question.textTotalCount} resposta(s) textual(is)
          </p>
          <ul className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {question.textSamples.map((sample) => (
              <li key={sample.answerId} className="rounded-lg border bg-muted/30 p-3">
                <p className="whitespace-pre-wrap text-sm">{sample.value}</p>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {formatDateTime(sample.submittedAt)} ·{' '}
                  <Link to={`/resultados/${formId}/${sample.submissionId}`} className="hover:underline">
                    ver submissão
                  </Link>
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {question.answeredCount === 0 ? (
        <p className="mt-5 flex items-center gap-2 text-sm text-muted-foreground">
          <Star className="h-4 w-4" aria-hidden="true" />
          Nenhuma resposta registrada para esta pergunta.
        </p>
      ) : null}
    </article>
  );
}

/** Converte a resposta armazenada em um texto legível para a tabela. */
function formatAnswer(
  answer: { text: string | null; json: unknown } | undefined,
  question: AnalyticQuestionView,
): string {
  if (!answer) return '—';
  if (answer.text && answer.text.trim() !== '') return answer.text;

  const settings = question.settings as {
    options?: { value: string; label: string }[];
    yesLabel?: string;
    noLabel?: string;
  };
  const readValue = (): string | null => {
    if (answer.json && typeof answer.json === 'object' && 'value' in answer.json) {
      return String((answer.json as { value: unknown }).value);
    }
    return null;
  };

  if (question.type === 'MULTIPLE_CHOICE') {
    const selected =
      answer.json && typeof answer.json === 'object' && 'selected' in answer.json
        ? ((answer.json as { selected: unknown }).selected as string[])
        : [];
    return selected
      .map((value) => settings.options?.find((option) => option.value === value)?.label ?? value)
      .join(', ');
  }

  const value = readValue();
  if (value === null) return '—';
  if (value === 'yes') return settings.yesLabel || 'Sim';
  if (value === 'no') return settings.noLabel || 'Não';
  return settings.options?.find((option) => option.value === value)?.label ?? value;
}
