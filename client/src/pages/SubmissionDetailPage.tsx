import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Clock } from 'lucide-react';
import { PageHeader } from '@/layouts/AdminLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { useForm, useSubmission } from '@/hooks/queries';
import { formatDateTime, formatDuration } from '@/utils/format';
import { QUESTION_TYPE_LABEL } from '@/utils/questions';
import type { SubmissionDetail } from '@/types';

export function SubmissionDetailPage() {
  const { formId, submissionId } = useParams<{ formId: string; submissionId: string }>();
  const formQuery = useForm(formId);
  const query = useSubmission(formId, submissionId);

  if (query.isLoading) return <LoadingState label="Carregando submissão…" />;

  if (query.isError || !query.data) {
    return (
      <div className="p-6">
        <ErrorState
          title="Submissão não encontrada"
          description={query.error?.message}
          onRetry={() => void query.refetch()}
        />
      </div>
    );
  }

  const submission = query.data.submission;

  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader
        title="Respostas enviadas"
        description={`${formQuery.data?.form.title ?? 'Formulário'} · versão v${submission.versionNumber}`}
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link to={`/resultados/${formId}`}>
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Voltar aos resultados
            </Link>
          </Button>
        }
      />

      <div className="flex-1 space-y-6 p-4 sm:p-6">
        <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4 text-sm">
          <Badge variant="secondary" className="gap-1.5">
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            {formatDateTime(submission.submittedAt)}
          </Badge>
          <Badge variant="outline">{formatDuration(submission.durationSeconds)}</Badge>
          <Badge variant="outline">ID {submission.id.slice(0, 8)}</Badge>
          <Badge variant="secondary">v{submission.versionNumber}</Badge>
        </div>

        {submission.answers.length === 0 ? (
          <p className="text-sm text-muted-foreground">Esta submissão não possui respostas.</p>
        ) : (
          <ol className="space-y-3">
            {submission.answers.map((answer, index) => (
              <li key={answer.questionKey}>
                <AnswerCard index={index} answer={answer} />
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

function AnswerCard({ index, answer }: { index: number; answer: SubmissionDetail['answers'][number] }) {
  return (
    <article className="rounded-xl border bg-card p-5">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[15px] font-semibold">
          <span className="mr-1.5 text-muted-foreground">{index + 1}.</span>
          {answer.title}
        </h2>
        <Badge variant="outline">{QUESTION_TYPE_LABEL[answer.type]}</Badge>
      </header>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">
        {renderAnswer(answer) || <span className="text-muted-foreground">Sem resposta</span>}
      </p>
    </article>
  );
}

function renderAnswer(answer: SubmissionDetail['answers'][number]): string {
  if (answer.text && answer.text.trim() !== '') return answer.text.trim();

  const settings = answer.settings as {
    options?: { value: string; label: string }[];
    yesLabel?: string;
    noLabel?: string;
    allowOther?: boolean;
    otherLabel?: string;
  };

  const json = answer.json as { value?: unknown; selected?: unknown } | null;

  if (json && Array.isArray(json.selected)) {
    return (json.selected as string[])
      .map((value) => {
        if (value === 'other') return `${settings.otherLabel || 'Outro'}: ${answer.text ?? ''}`.trim();
        return settings.options?.find((option) => option.value === value)?.label ?? value;
      })
      .join(', ');
  }

  if (json && json.value !== undefined) {
    const value = String(json.value);
    if (value === 'yes') return settings.yesLabel || 'Sim';
    if (value === 'no') return settings.noLabel || 'Não';
    return settings.options?.find((option) => option.value === value)?.label ?? value;
  }

  return '';
}
