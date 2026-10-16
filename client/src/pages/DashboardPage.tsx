import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  BarChart3,
  Copy,
  ExternalLink,
  FileText,
  Globe,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Send,
  Trash2,
  Archive,
} from 'lucide-react';
import { PageHeader } from '@/layouts/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { FormStatusBadge } from '@/components/FormStatusBadge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { useDebounced, useFormsList } from '@/hooks/queries';
import { formsService } from '@/services/api';
import { formatRelative, formatNumber } from '@/utils/format';
import { FORM_STATUS_LABEL } from '@/utils/questions';
import { toast } from '@/components/ui/toast';
import type { FormStatus, FormSummary } from '@/types';

const STATUS_FILTERS: { value: FormStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'Todos' },
  { value: 'PUBLISHED', label: FORM_STATUS_LABEL.PUBLISHED },
  { value: 'DRAFT', label: FORM_STATUS_LABEL.DRAFT },
  { value: 'ARCHIVED', label: FORM_STATUS_LABEL.ARCHIVED },
];

export function DashboardPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<FormStatus | 'ALL'>('ALL');
  const [pendingDelete, setPendingDelete] = useState<FormSummary | null>(null);
  const debouncedSearch = useDebounced(search);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const query = useFormsList({
    search: debouncedSearch || undefined,
    status: status === 'ALL' ? undefined : status,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['forms'] });

  const publishMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'publish' | 'unpublish' | 'archive' }) =>
      action === 'publish'
        ? formsService.publish(id)
        : action === 'unpublish'
          ? formsService.unpublish(id)
          : formsService.archive(id),
    onSuccess: (_data, variables) => {
      void invalidate();
      toast.success(
        variables.action === 'publish'
          ? 'Formulário publicado. O link público já está ativo.'
          : variables.action === 'unpublish'
            ? 'Formulário despublicado.'
            : 'Formulário arquivado.',
      );
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const duplicateMutation = useMutation({
    mutationFn: (id: string) => formsService.duplicate(id),
    onSuccess: (result) => {
      void invalidate();
      toast.success('Formulário duplicado como rascunho.');
      navigate(`/formularios/${result.form.id}/editar`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => formsService.remove(id),
    onSuccess: () => {
      void invalidate();
      setPendingDelete(null);
      toast.success('Formulário excluído.');
    },
    onError: (error: Error) => {
      toast.error(error.message);
      setPendingDelete(null);
    },
  });

  const forms = query.data?.forms ?? [];
  const totalResponses = useMemo(
    () => forms.reduce((sum, form) => sum + form.submissionCount, 0),
    [forms],
  );

  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader
        title="Formulários"
        description={
          forms.length > 0
            ? `${forms.length} ${forms.length === 1 ? 'formulário' : 'formulários'} · ${formatNumber(totalResponses)} respostas no total`
            : 'Crie seu primeiro formulário e publique um link para compartilhar.'
        }
        actions={
          <Button onClick={() => navigate('/formularios/novo')}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Novo formulário
          </Button>
        }
      />

      <div className="flex-1 space-y-5 p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por título"
              aria-label="Buscar formulários"
              className="pl-9"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1 rounded-lg bg-muted p-1">
            {STATUS_FILTERS.map((filter) => (
              <button
                key={filter.value}
                type="button"
                onClick={() => setStatus(filter.value)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  status === filter.value
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                aria-pressed={status === filter.value}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {query.isLoading ? <LoadingState label="Carregando formulários…" /> : null}

        {query.isError ? (
          <ErrorState
            description={query.error.message}
            onRetry={() => void query.refetch()}
          />
        ) : null}

        {query.isSuccess && forms.length === 0 ? (
          search || status !== 'ALL' ? (
            <EmptyState
              title="Nenhum formulário encontrado"
              description="Ajuste a busca ou o filtro de status para ver outros formulários."
              action={
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearch('');
                    setStatus('ALL');
                  }}
                >
                  Limpar filtros
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={<FileText className="h-5 w-5" />}
              title="Comece seu primeiro formulário"
              description="Adicione perguntas, visualize a prévia e publique um link público para coletar respostas."
              action={
                <Button onClick={() => navigate('/formularios/novo')}>
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Criar formulário
                </Button>
              }
            />
          )
        ) : null}

        {forms.length > 0 ? (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {forms.map((form) => (
              <li key={form.id}>
                <FormCard
                  form={form}
                  onEdit={() => navigate(`/formularios/${form.id}/editar`)}
                  onPublish={() => publishMutation.mutate({ id: form.id, action: 'publish' })}
                  onUnpublish={() => publishMutation.mutate({ id: form.id, action: 'unpublish' })}
                  onArchive={() => publishMutation.mutate({ id: form.id, action: 'archive' })}
                  onDuplicate={() => duplicateMutation.mutate(form.id)}
                  onDelete={() => setPendingDelete(form)}
                  busy={publishMutation.isPending || duplicateMutation.isPending}
                />
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <AlertDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir “{pendingDelete?.title}”?</AlertDialogTitle>
            <AlertDialogDescription>
              O formulário, todas as perguntas e <strong>todas as respostas coletadas</strong> serão
              removidos permanentemente. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                if (pendingDelete) deleteMutation.mutate(pendingDelete.id);
              }}
            >
              Excluir definitivamente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

type FormCardProps = {
  form: FormSummary;
  onEdit: () => void;
  onPublish: () => void;
  onUnpublish: () => void;
  onArchive: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  busy: boolean;
};

function FormCard({
  form,
  onEdit,
  onPublish,
  onUnpublish,
  onArchive,
  onDuplicate,
  onDelete,
  busy,
}: FormCardProps) {
  const publicPath = `/f/${form.slug}`;

  return (
    <article className="group flex h-full flex-col rounded-xl border bg-card p-5 transition-shadow hover:border-foreground/20">
      <div className="flex items-start justify-between gap-3">
        <Link
          to={`/formularios/${form.id}/editar`}
          className="min-w-0 flex-1 rounded-sm outline-offset-4"
        >
          <h2 className="truncate text-[15px] font-semibold tracking-tight">{form.title}</h2>
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="-mr-2 -mt-2 h-8 w-8 text-muted-foreground"
              aria-label={`Ações para ${form.title}`}
              disabled={busy}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel>Formulário</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onEdit}>
              <Pencil className="h-4 w-4" aria-hidden="true" />
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to={`/resultados/${form.id}`}>
                <BarChart3 className="h-4 w-4" aria-hidden="true" />
                Ver resultados
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onDuplicate}>
              <Copy className="h-4 w-4" aria-hidden="true" />
              Duplicar
            </DropdownMenuItem>

            <DropdownMenuSeparator />
            {form.status === 'PUBLISHED' ? (
              <>
                <DropdownMenuItem asChild>
                  <a href={publicPath} target="_blank" rel="noreferrer noopener">
                    <ExternalLink className="h-4 w-4" aria-hidden="true" />
                    Abrir página pública
                  </a>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={onUnpublish}>
                  <Globe className="h-4 w-4" aria-hidden="true" />
                  Despublicar
                </DropdownMenuItem>
              </>
            ) : (
              <DropdownMenuItem onSelect={onPublish}>
                <Send className="h-4 w-4" aria-hidden="true" />
                Publicar
              </DropdownMenuItem>
            )}

            {form.status !== 'ARCHIVED' ? (
              <DropdownMenuItem onSelect={onArchive}>
                <Archive className="h-4 w-4" aria-hidden="true" />
                Arquivar
              </DropdownMenuItem>
            ) : null}

            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={onDelete}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {form.description ? (
        <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{form.description}</p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <FormStatusBadge status={form.status} />
        <Badge variant="outline">
          {form.questionCount} {form.questionCount === 1 ? 'pergunta' : 'perguntas'}
        </Badge>
        <Badge variant="outline">
          {formatNumber(form.submissionCount)}{' '}
          {form.submissionCount === 1 ? 'resposta' : 'respostas'}
        </Badge>
      </div>

      <div className="mt-auto flex items-center justify-between gap-3 border-t pt-4 text-xs text-muted-foreground">
        <span>Atualizado {formatRelative(form.updatedAt)}</span>
        <Link
          to={`/formularios/${form.id}/editar`}
          className="font-medium text-foreground hover:underline"
        >
          Abrir editor
        </Link>
      </div>
    </article>
  );
}