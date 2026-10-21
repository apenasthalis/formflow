import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Clock, Trash2 } from 'lucide-react';
import { PageHeader } from '@/layouts/AdminLayout';
import { toast } from '@/components/ui/toast';
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
import { Badge } from '@/components/ui/badge';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useSubmission } from '@/hooks/queries';
import { resultsService } from '@/services/api';
import { formatDateTime, formatDuration } from '@/utils/format';
import { QUESTION_TYPE_LABEL } from '@/utils/questions';
import type { SubmissionDetail } from '@/types';

export function SubmissionDetailPage() {
  const { formId, submissionId } = useParams<{ formId: string; submissionId: string }>();
  const formQuery = useForm(formId);
  const query = useSubmission(formId, submissionId);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const deleteMutation = useMutation({
    mutationFn: () => resultsService.removeSubmission(formId as string, submissionId as string),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['submissions', formId] });
      void queryClient.invalidateQueries({ queryKey: ['analytics', formId] });
      toast.success('Resposta excluída.');
      navigate(`/resultados/${formId}`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

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
          <>
            <Button variant="outline" size="sm" asChild>
              <Link to={`/resultados/${formId}`}>
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Voltar aos resultados
              </Link>
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setConfirmOpen(true)}
              disabled={deleteMutation.isPending}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Excluir
            </Button>
          </>
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

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir esta resposta?</AlertDialogTitle>
            <AlertDialogDescription>
              A resposta selecionada será removida permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate()}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
