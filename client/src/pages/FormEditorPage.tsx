import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  BarChart3,
  Check,
  Copy,
  Eye,
  AlertCircle,
  Globe,
  Loader2,
  Plus,
  Settings2,
  SquarePen,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { FormStatusBadge } from '@/components/FormStatusBadge';
import { ErrorState, LoadingState } from '@/components/ui/states';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { QuestionListPanel, MobileQuestionStrip } from '@/components/editor/QuestionListPanel';
import {
  Field,
  QuestionTypeSelect,
  ToggleRow,
  TypeSettingsFields,
} from '@/components/editor/TypeSettingsFields';
import { FormRunner } from '@/components/runner/FormRunner';
import { toast } from '@/components/ui/toast';
import { useDebouncedCallback } from '@/hooks/useDebouncedCallback';
import { useForm } from '@/hooks/queries';
import { formsService, questionsService, type FormPayload, type QuestionPayload } from '@/services/api';
import { ApiError } from '@/services/http';
import { QUESTION_TYPE_DESCRIPTION, QUESTION_TYPE_LABEL, defaultSettingsFor } from '@/utils/questions';
import { QUESTION_TYPES } from '@/types';
import type { Form, FormDetail, PublicForm, Question, QuestionType } from '@/types';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

const formQueryKey = (formId: string) => ['form', formId] as const;

/**
 * O servidor normaliza os textos (remove espaços das pontas, preenche
 * configurações), então a resposta nunca é idêntica ao que está no campo.
 * Aplicá-la como está faria o espaço recém-digitado desaparecer e as palavras
 * se grudarem. Por isso os campos editáveis mantêm o valor local — que é a
 * fonte da verdade enquanto o formulário estiver aberto — e o servidor entra
 * só com o que ele calcula (status, posições, datas).
 */
function mergeForm<T extends Form>(server: T, local: Form | undefined): T {
  if (!local) return server;
  const localById = new Map(local.questions.map((question) => [question.id, question]));
  const merged = { ...server };
  merged.title = local.title;
  merged.slug = local.slug;
  merged.description = local.description;
  merged.welcomeMessage = local.welcomeMessage;
  merged.thankYouMessage = local.thankYouMessage;
  merged.questions = server.questions.map((question) =>
    mergeQuestion(question, localById.get(question.id)),
  );
  return merged;
}

function mergeQuestion(server: Question, local: Question | undefined): Question {
  if (!local) return server;
  return {
    ...server,
    title: local.title,
    description: local.description,
    errorMessage: local.errorMessage,
    settings: local.settings,
  };
}

export function FormEditorPage() {
  const { formId } = useParams<{ formId: string }>();
  const queryClient = useQueryClient();
  const query = useForm(formId);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [focusTitleFor, setFocusTitleFor] = useState<string | null>(null);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Question | null>(null);
  const [pendingType, setPendingType] = useState<QuestionType | null>(null);

  const form = query.data?.form;

  // Seleciona a primeira pergunta assim que o formulário carrega.
  useEffect(() => {
    if (!form) return;
    const questions = form.questions;
    if (questions.length === 0) {
      setSelectedId(null);
      return;
    }
    setSelectedId((current) => {
      if (current && questions.some((question) => question.id === current)) return current;
      return questions[0]!.id;
    });
  }, [form]);

  const setCacheForm = (updater: (form: Form) => Form) => {
    queryClient.setQueryData(formQueryKey(formId as string), (previous: { form: Form } | undefined) => {
      if (!previous) return previous;
      return { form: updater(previous.form) };
    });
  };

  /** Aplica o que veio do servidor preservando o texto que está sendo digitado. */
  const writeFormFromServer = (server: Form, local?: Form) => {
    queryClient.setQueryData(formQueryKey(formId as string), (previous: { form: Form } | undefined) => ({
      form: mergeForm(server, local ?? previous?.form),
    }));
  };

  /**
   * Recarrega o formulário do servidor mantendo as edições locais. A busca é
   * explícita (e não um refetch) porque o refetch sobrescreveria o rascunho no
   * cache antes do merge, o que apagaria algo digitado durante a requisição.
   */
  const refreshFromServer = async () => {
    try {
      const { form } = await formsService.get(formId as string);
      writeFormFromServer(form);
    } catch {
      // Falhar ao recarregar não interrompe a ação que disparou a atualização.
    }
  };

  /* ------------------------------ Mutations ----------------------------- */

  /**
   * Todas as mutações do editor compartilham um escopo: o react-query executa
   * uma de cada vez. Assim uma publicação nunca corre antes do salvamento do
   * que acabou de ser digitado (o slug do link público, por exemplo).
   */
  const editorScope = { id: `editor:${formId}` };

  const formMutation = useMutation({
    scope: editorScope,
    mutationFn: (payload: FormPayload) => formsService.update(formId as string, payload),
    onSuccess: (result) => {
      writeFormFromServer(result.form);
      setSaveState('saved');
    },
    onError: (error: Error) => {
      setSaveState('error');
      toast.error(error.message);
    },
  });

  const questionMutation = useMutation({
    scope: editorScope,
    mutationFn: ({ questionId, payload }: { questionId: string; payload: QuestionPayload }) =>
      questionsService.update(questionId, payload),
    onSuccess: (result) => {
      queryClient.setQueryData(
        formQueryKey(formId as string),
        (previous: { form: Form } | undefined) =>
          previous
            ? {
                form: {
                  ...previous.form,
                  questions: previous.form.questions.map((question) =>
                    question.id === result.question.id
                      ? mergeQuestion(result.question, question)
                      : question,
                  ),
                },
              }
            : previous,
      );
      setSaveState('saved');
    },
    onError: (error: Error) => {
      setSaveState('error');
      toast.error(error.message);
    },
  });

  const addQuestionMutation = useMutation({
    scope: editorScope,
    mutationFn: (type: QuestionType) =>
      questionsService.create(formId as string, {
        type,
        title: '',
        required: false,
        settings: defaultSettingsFor(type),
      }),
    onSuccess: (result) => {
      queryClient.setQueryData(formQueryKey(formId as string), (previous: { form: Form } | undefined) =>
        previous ? { form: mergeForm(result.form, previous.form) } : result,
      );
      setSelectedId(result.question.id);
      // O foco vai direto ao enunciado da pergunta recém-criada.
      setFocusTitleFor(result.question.id);
      setSaveState('saved');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const duplicateQuestionMutation = useMutation({
    scope: editorScope,
    mutationFn: (questionId: string) => questionsService.duplicate(questionId),
    onSuccess: (result) => {
      void refreshFromServer();
      setSelectedId(result.question.id);
      toast.success('Pergunta duplicada.');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteQuestionMutation = useMutation({
    scope: editorScope,
    mutationFn: (questionId: string) => questionsService.remove(questionId),
    onSuccess: () => {
      void refreshFromServer();
      setPendingDelete(null);
      toast.success('Pergunta excluída.');
    },
    onError: (error: Error) => {
      toast.error(error.message);
      setPendingDelete(null);
    },
  });

  const reorderMutation = useMutation({
    scope: editorScope,
    mutationFn: (questionIds: string[]) => questionsService.reorder(formId as string, questionIds),
    onSuccess: (result) => {
      writeFormFromServer(result.form);
      setSaveState('saved');
    },
    onError: (error: Error) => {
      toast.error(error.message);
      void refreshFromServer();
    },
  });

  const publishMutation = useMutation({
    scope: editorScope,
    mutationFn: (action: 'publish' | 'unpublish') =>
      action === 'publish'
        ? formsService.publish(formId as string)
        : formsService.unpublish(formId as string),
    onSuccess: (_result, action) => {
      void refreshFromServer();
      toast.success(
        action === 'publish'
          ? 'Formulário publicado. O link público está ativo.'
          : 'Formulário despublicado.',
      );
    },
    onError: (error: Error) =>
      toast.error(
        error instanceof ApiError ? error.message : 'Não foi possível alterar a publicação.',
      ),
  });

  /* --------------------------- Salvamento automático ---------------------
   *
   * As alterações ficam em um buffer por pergunta e por formulário e são
   * enviadas juntas após um breve intervalo. Isso evita perder um campo quando
   * a pessoa edita o enunciado e as opções em sequência rápida.
   */

  const pendingQuestions = useRef(new Map<string, QuestionPayload>());
  const pendingForm = useRef<FormPayload>({});

  /** Envia o que está no buffer. Não faz nada quando não há alteração pendente. */
  const flushSaves = useCallback(() => {
    const perguntas = [...pendingQuestions.current.entries()].filter(
      ([, payload]) => Object.keys(payload).length > 0,
    );
    const form = pendingForm.current;
    pendingQuestions.current.clear();
    pendingForm.current = {};

    if (perguntas.length === 0 && Object.keys(form).length === 0) return;

    setSaveState('saving');
    for (const [questionId, payload] of perguntas) {
      questionMutation.mutate({ questionId, payload });
    }
    if (Object.keys(form).length > 0) formMutation.mutate(form);
  }, [formMutation, questionMutation]);

  const scheduleSave = useDebouncedCallback(() => {
    flushSaves();
  }, 600);

  // Alterações pendentes são enviadas mesmo que a pessoa saia da tela.
  useEffect(
    () => () => {
      flushSaves();
    },
    [flushSaves],
  );

  const updateQuestion = (question: Question, patch: QuestionPayload) => {
    setCacheForm((previous) => ({
      ...previous,
      questions: previous.questions.map((item) =>
        item.id === question.id
          ? { ...item, ...patch, settings: patch.settings ?? item.settings }
          : item,
      ),
    }));
    pendingQuestions.current.set(question.id, {
      ...pendingQuestions.current.get(question.id),
      ...patch,
    });
    scheduleSave.debounced();
  };

  /**
   * Atualiza as configurações a partir do estado mais recente do cache.
   * Editar o enunciado e as opções em sequência rápida não perde nenhuma das
   * duas alterações, porque cada atualização parte do valor já salvo.
   */
  const updateQuestionSettings = (
    question: Question,
    updater: (settings: Question['settings']) => Question['settings'],
  ) => {
    let nextSettings: Question['settings'] | null = null;

    setCacheForm((previous) => ({
      ...previous,
      questions: previous.questions.map((item) => {
        if (item.id !== question.id) return item;
        nextSettings = updater(item.settings);
        return { ...item, settings: nextSettings };
      }),
    }));

    if (!nextSettings) return;
    pendingQuestions.current.set(question.id, {
      ...pendingQuestions.current.get(question.id),
      settings: nextSettings,
    });
    scheduleSave.debounced();
  };

  const updateForm = (patch: FormPayload) => {
    setCacheForm((previous) => ({ ...previous, ...patch }));
    pendingForm.current = { ...pendingForm.current, ...patch };
    scheduleSave.debounced();
  };

  const handleMove = (questionId: string, direction: 'up' | 'down') => {
    if (!form) return;
    const ids = form.questions.map((question) => question.id);
    const index = ids.indexOf(questionId);
    const target = direction === 'up' ? index - 1 : index + 1;
    if (index < 0 || target < 0 || target >= ids.length) return;
    const next = [...ids];
    next.splice(index, 1);
    next.splice(target, 0, questionId);

    setCacheForm((previous) => ({
      ...previous,
      questions: next
        .map((id) => previous.questions.find((question) => question.id === id))
        .filter((question): question is Question => Boolean(question))
        .map((question, position) => ({ ...question, position })),
    }));
    reorderMutation.mutate(next);
  };

  /**
   * Publicar só depois de gravar o rascunho. O link público (slug) definido em
   * Configurações faz parte dele: enviar a publicação com o buffer ainda vazio
   * faria o endpoint usar o endereço antigo.
   */
  const handlePublish = () => {
    flushSaves();
    publishMutation.mutate('publish');
  };

  const handleUnpublish = () => {
    flushSaves();
    publishMutation.mutate('unpublish');
  };

  /**
   * Trocar o tipo substitui as configurações — alternativas, rótulos, escala —
   * pelas padrão do novo tipo. Enunciado, descrição e obrigatoriedade ficam.
   */
  const confirmTypeChange = () => {
    const next = pendingType;
    if (!next || !selected) {
      setPendingType(null);
      return;
    }
    setPendingType(null);
    updateQuestion(selected, { type: next, settings: defaultSettingsFor(next) });
    toast.success(`Tipo alterado para ${QUESTION_TYPE_LABEL[next]}.`);
  };

  // Foca o enunciado assim que a pergunta recién-criada entra no editor.
  useEffect(() => {
    if (!focusTitleFor || selectedId !== focusTitleFor) return;
    setFocusTitleFor(null);
    const node = titleRef.current;
    if (!node) return;
    const timer = window.setTimeout(() => {
      node.focus();
      node.setSelectionRange(node.value.length, node.value.length);
    }, 120);
    return () => window.clearTimeout(timer);
  }, [focusTitleFor, selectedId]);

  const previewForm: PublicForm | null = useMemo(() => {
    if (!form) return null;
    return {
      slug: form.slug,
      versionNumber: 0,
      title: form.title,
      description: form.description,
      welcomeMessage: form.welcomeMessage,
      thankYouMessage: form.thankYouMessage,
      questions: form.questions.map((question, index) => ({
        key: question.id,
        position: index,
        title: question.title || 'Pergunta sem título',
        description: question.description,
        type: question.type,
        required: question.required,
        errorMessage: question.errorMessage,
        settings: question.settings,
      })),
    };
  }, [form]);

  if (query.isLoading) return <LoadingState label="Carregando formulário…" />;

  if (query.isError || !form) {
    return (
      <div className="p-6">
        <ErrorState
          title="Formulário não encontrado"
          description={query.error?.message}
          onRetry={() => void query.refetch()}
        />
      </div>
    );
  }

  const selected = form.questions.find((question) => question.id === selectedId) ?? null;
  const publicUrl = `${window.location.origin}/f/${form.slug}`;

  return (
    <div className="flex min-h-screen flex-col">
      <EditorHeader
        form={form}
        hasUnpublishedChanges={form.hasUnpublishedChanges}
        saveState={saveState}
        publicUrl={publicUrl}
        busy={publishMutation.isPending}
        onPreview={() => setPreviewOpen(true)}
        onSettings={() => setSettingsOpen(true)}
        onPublish={handlePublish}
        onUnpublish={handleUnpublish}
        onTitleChange={(title) => updateForm({ title })}
      />

      <MobileQuestionStrip
        questions={form.questions}
        selectedId={selectedId}
        onSelect={setSelectedId}
      />

      <div className="grid flex-1 lg:grid-cols-[280px_minmax(0,1fr)_320px]">
        <div className="hidden border-r lg:block">
          <div className="sticky top-0 h-[calc(100vh-8.5rem)]">
            <QuestionListPanel
              questions={form.questions}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onAdd={(type) => addQuestionMutation.mutate(type)}
              onDuplicate={(id) => duplicateQuestionMutation.mutate(id)}
              onDelete={(id) => {
                const question = form.questions.find((item) => item.id === id);
                if (question) setPendingDelete(question);
              }}
              onMove={handleMove}
            />
          </div>
        </div>

        <div className="min-w-0 bg-muted/20 px-4 py-6 sm:px-8">
          {selected ? (
            // Entrada curta e sem saída: enquanto a pergunta anterior sai, os
            // dois campos de enunciado ficariam duplicados no DOM.
            <motion.div
              key={selected.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.16, ease: 'easeOut' }}
              className="mx-auto max-w-2xl space-y-6"
            >
                <div className="rounded-xl border bg-card p-5 space-y-5">
                  <div className="space-y-1.5">
                    <Label htmlFor="question-title">Enunciado</Label>
                    <Textarea
                      id="question-title"
                      ref={titleRef}
                      value={selected.title}
                      rows={2}
                      placeholder="O que você quer perguntar?"
                      onChange={(event) => updateQuestion(selected, { title: event.target.value })}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="question-description">
                      Descrição <span className="font-normal text-muted-foreground">(opcional)</span>
                    </Label>
                    <Textarea
                      id="question-description"
                      value={selected.description ?? ''}
                      rows={2}
                      placeholder="Contexto adicional exibido abaixo do enunciado."
                      onChange={(event) =>
                        updateQuestion(selected, { description: event.target.value || null })
                      }
                    />
                  </div>
                </div>

                <div className="rounded-xl border bg-card p-5">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-sm font-semibold">Opções da pergunta</h2>
                    <QuestionTypeSelect
                      value={selected.type}
                      onChange={(type) => setPendingType(type)}
                    />
                  </div>
                  <TypeSettingsFields
                    question={selected}
                    onChange={(updater) => updateQuestionSettings(selected, updater)}
                  />
                </div>

                {/* Ações de pergunta ficam aqui em telas menores. */}
                <div className="flex flex-wrap items-center gap-2 lg:hidden">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => duplicateQuestionMutation.mutate(selected.id)}
                  >
                    <Copy className="h-4 w-4" aria-hidden="true" />
                    Duplicar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleMove(selected.id, 'up')}
                  >
                    Mover para cima
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleMove(selected.id, 'down')}
                  >
                    Mover para baixo
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive"
                    onClick={() => setPendingDelete(selected)}
                  >
                    Excluir
                  </Button>
                </div>
            </motion.div>
          ) : (
            <div className="mx-auto max-w-2xl rounded-xl border border-dashed p-12 text-center">
              <h2 className="text-base font-semibold">
                {form.questions.length === 0 ? 'Nenhuma pergunta ainda' : 'Nenhuma pergunta selecionada'}
              </h2>
              <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
                {form.questions.length === 0
                  ? 'Adicione a primeira pergunta para montar o formulário. Você poderá reordenar, duplicar e remover a qualquer momento.'
                  : 'Escolha uma pergunta na lista para editá-la.'}
              </p>
              {form.questions.length === 0 ? (
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  {QUESTION_TYPES.map((type) => (
                    <Button
                      key={type}
                      variant="outline"
                      size="sm"
                      onClick={() => addQuestionMutation.mutate(type)}
                      disabled={addQuestionMutation.isPending}
                    >
                      <Plus className="h-4 w-4" aria-hidden="true" />
                      {QUESTION_TYPE_LABEL[type]}
                    </Button>
                  ))}
                </div>
              ) : null}
            </div>
          )}
        </div>

        <aside className="hidden border-l bg-background lg:block">
          <div className="sticky top-0 max-h-[calc(100vh-8.5rem)] space-y-6 overflow-y-auto p-5">
            <PropertiesPanel
              question={selected}
              form={form}
              onUpdateQuestion={updateQuestion}
              onDuplicate={(id) => duplicateQuestionMutation.mutate(id)}
              onDelete={(question) => setPendingDelete(question)}
              onMove={handleMove}
            />
          </div>
        </aside>
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl overflow-hidden p-0">
          <DialogHeader className="border-b p-5">
            <DialogTitle>Pré-visualização</DialogTitle>
            <DialogDescription>
             Veja exatamente como o participante responders. Nada é enviado ao servidor neste modo.
            </DialogDescription>
          </DialogHeader>
          <div className="h-[70vh] overflow-y-auto">
            {previewForm ? <FormRunner form={previewForm} mode="preview" /> : null}
          </div>
        </DialogContent>
      </Dialog>

      <FormSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        form={form}
        publicUrl={publicUrl}
        onUpdate={updateForm}
        onFlush={() => scheduleSave.flush()}
      />

      <AlertDialog
        open={pendingType !== null}
        onOpenChange={(open) => {
          if (!open) setPendingType(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Alterar o tipo da pergunta?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingType && selected ? (
                <>
                  A pergunta passa de <strong>{QUESTION_TYPE_LABEL[selected.type]}</strong> para{' '}
                  <strong>{QUESTION_TYPE_LABEL[pendingType]}</strong>. As opções configuradas para o
                  tipo atual são substituídas pelas padrão do novo tipo — enunciado, descrição e
                  obrigatoriedade são mantidos.
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmTypeChange}>Alterar tipo</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir esta pergunta?</AlertDialogTitle>
            <AlertDialogDescription>
              “{pendingDelete?.title || 'Pergunta sem título'}” será removida do formulário. As
              respostas já coletadas continuam salvas no histórico.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                if (pendingDelete) deleteQuestionMutation.mutate(pendingDelete.id);
              }}
            >
              Excluir pergunta
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

type EditorHeaderProps = {
  form: FormDetail;
  hasUnpublishedChanges: boolean;
  saveState: SaveState;
  publicUrl: string;
  busy: boolean;
  onPreview: () => void;
  onSettings: () => void;
  onPublish: () => void;
  onUnpublish: () => void;
  onTitleChange: (title: string) => void;
};

function EditorHeader({
  form,
  hasUnpublishedChanges,
  saveState,
  publicUrl,
  busy,
  onPreview,
  onSettings,
  onPublish,
  onUnpublish,
  onTitleChange,
}: EditorHeaderProps) {
  const [copied, setCopied] = useState(false);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Não foi possível copiar o link. Copie manualmente da barra de endereço.');
    }
  };

  return (
    <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
      <div className="flex flex-col gap-3 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild aria-label="Voltar ao painel">
            <Link to="/">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>

          <div className="min-w-0 flex-1">
            <Input
              value={form.title}
              onChange={(event) => onTitleChange(event.target.value)}
              aria-label="Título do formulário"
              className="h-9 border-transparent bg-transparent px-2 text-base font-semibold shadow-none hover:border-input focus-visible:ring-offset-0"
            />
            <div className="flex items-center gap-2 px-2 pt-0.5">
              <FormStatusBadge status={form.status} />
              <SaveIndicator state={saveState} />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={onSettings} aria-label="Configurações do formulário">
              <Settings2 className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={onPreview}>
              <Eye className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Pré-visualizar</span>
            </Button>

            {form.status === 'PUBLISHED' ? (
              <>
                <Button variant="ghost" size="sm" asChild>
                  <a href={publicUrl} target="_blank" rel="noreferrer noopener">
                    <Globe className="h-4 w-4" aria-hidden="true" />
                    <span className="hidden md:inline">Abrir link</span>
                  </a>
                </Button>
                <Button variant="outline" size="sm" onClick={onUnpublish} disabled={busy}>
                  Despublicar
                </Button>
              </>
            ) : (
              <Button size="sm" onClick={onPublish} disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Publicar
              </Button>
            )}

            <Button variant="ghost" size="icon" asChild aria-label="Ver resultados">
              <Link to={`/resultados/${form.id}`}>
                <BarChart3 className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>

        {form.status === 'PUBLISHED' ? (
          <>
            <div className="flex items-center gap-2 overflow-hidden rounded-lg bg-muted/60 px-3 py-1.5 text-xs">
              <Globe className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="truncate text-muted-foreground">{publicUrl}</span>
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto h-7 shrink-0 px-2"
                onClick={() => void copyLink()}
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copiado' : 'Copiar'}
              </Button>
            </div>

            {hasUnpublishedChanges ? (
              <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>
                  Há alterações no rascunho. Elas valem para novas respostas depois que você
                  republicar — as respostas já coletadas continuam vinculadas à versão atual.
                </span>
                <Button
                  size="sm"
                  className="ml-auto h-7 px-2"
                  onClick={onPublish}
                  disabled={busy}
                >
                  Publicar alterações
                </Button>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </header>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === 'saving') {
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
        Salvando…
      </span>
    );
  }
  if (state === 'saved') {
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Check className="h-3 w-3" aria-hidden="true" />
        Salvo
      </span>
    );
  }
  if (state === 'error') {
    return <span className="text-xs text-destructive">Falha ao salvar</span>;
  }
  return null;
}

type PropertiesPanelProps = {
  question: Question | null;
  form: Form;
  onUpdateQuestion: (question: Question, patch: QuestionPayload) => void;
  onDuplicate: (id: string) => void;
  onDelete: (question: Question) => void;
  onMove: (id: string, direction: 'up' | 'down') => void;
};

function PropertiesPanel({
  question,
  form,
  onUpdateQuestion,
  onDuplicate,
  onDelete,
  onMove,
}: PropertiesPanelProps) {
  const index = question ? form.questions.findIndex((item) => item.id === question.id) : -1;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-semibold">Propriedades</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Ajuste o comportamento da pergunta selecionada.
        </p>
      </div>

      {question ? (
        <>
          <div className="space-y-4">
            <ToggleRow
              id="required"
              label="Obrigatória"
              description="O participante não consegue pular esta pergunta."
              checked={question.required}
              onChange={(checked) => onUpdateQuestion(question, { required: checked })}
            />

            <Field
              label="Mensagem de erro"
              htmlFor="errorMessage"
              hint="Exibida quando a resposta não for válida. Deixe vazio para usar a mensagem padrão."
            >
              <Input
                id="errorMessage"
                value={question.errorMessage ?? ''}
                placeholder="Esta pergunta é obrigatória."
                onChange={(event) =>
                  onUpdateQuestion(question, { errorMessage: event.target.value || null })
                }
              />
            </Field>
          </div>

          <div className="space-y-3 border-t pt-5">
            <h3 className="text-sm font-medium">Ações</h3>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => onDuplicate(question.id)}>
                <Copy className="h-4 w-4" aria-hidden="true" />
                Duplicar
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={index <= 0}
                onClick={() => onMove(question.id, 'up')}
              >
                Mover para cima
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={index >= form.questions.length - 1}
                onClick={() => onMove(question.id, 'down')}
              >
                Mover para baixo
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive"
                onClick={() => onDelete(question)}
              >
                Excluir
              </Button>
            </div>
          </div>

          <div className="space-y-2 border-t pt-5 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">Detalhes</p>
            <p>Posição: {index + 1} de {form.questions.length}</p>
            <p>Tipo: {QUESTION_TYPE_LABEL[question.type]}</p>
            <p>{QUESTION_TYPE_DESCRIPTION[question.type]}</p>
            <p className="break-all">ID: {question.id}</p>
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          Nenhuma pergunta selecionada. Escolha uma na lista.
        </p>
      )}
    </div>
  );
}

function FormSettingsDialog({
  open,
  onOpenChange,
  form,
  publicUrl,
  onUpdate,
  onFlush,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: Form;
  publicUrl: string;
  onUpdate: (patch: FormPayload) => void;
  onFlush: () => void;
}) {
  const [slug, setSlug] = useState(form.slug);
  const [slugError, setSlugError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setSlug(form.slug);
      setSlugError(null);
    }
  }, [open, form.slug]);

  const commitSlug = () => {
    const value = slug.trim();
    if (value === form.slug) return;
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
      setSlugError('Use apenas letras minúsculas, números e hífens.');
      return;
    }
    setSlugError(null);
    onUpdate({ slug: value });
    onFlush();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Configurações do formulário</DialogTitle>
          <DialogDescription>
            Textos exibidos antes e depois das perguntas e o endereço público de resposta.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-5 overflow-y-auto pr-1">
          <Field
            label="Link público"
            htmlFor="slug"
            hint="O mesmo link continua funcionando após pequenas alterações de conteúdo."
          >
            <div className="flex gap-2">
              <Input
                id="slug"
                value={slug}
                onChange={(event) => setSlug(event.target.value)}
                onBlur={commitSlug}
              />
              <Button variant="outline" onClick={commitSlug}>
                Salvar
              </Button>
            </div>
            {slugError ? <p className="text-xs text-destructive">{slugError}</p> : null}
            <p className="text-xs text-muted-foreground">{publicUrl}</p>
          </Field>

          <Field
            label="Mensagem de boas-vindas"
            htmlFor="welcome"
            hint="Exibida na tela inicial, antes da primeira pergunta."
          >
            <Textarea
              id="welcome"
              rows={2}
              value={form.welcomeMessage ?? ''}
              placeholder="Ex.: Sua opinião ajuda a moldar o próximo lançamento."
              onChange={(event) => onUpdate({ welcomeMessage: event.target.value || null })}
              onBlur={onFlush}
            />
          </Field>

          <Field
            label="Mensagem final"
            htmlFor="thankyou"
            hint="Exibida depois que o participante envia as respostas."
          >
            <Textarea
              id="thankyou"
              rows={2}
              value={form.thankYouMessage ?? ''}
              placeholder="Ex.: Obrigado por participar!"
              onChange={(event) => onUpdate({ thankYouMessage: event.target.value || null })}
              onBlur={onFlush}
            />
          </Field>

          <Field label="Descrição" htmlFor="formDescription">
            <Textarea
              id="formDescription"
              rows={3}
              value={form.description ?? ''}
              onChange={(event) => onUpdate({ description: event.target.value || null })}
              onBlur={onFlush}
            />
          </Field>

          <div className="rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
            <p className="flex items-center gap-1.5 font-medium text-foreground">
              <SquarePen className="h-3.5 w-3.5" aria-hidden="true" />
              Publicação
            </p>
            <p className="mt-1">
              As alterações só passam a valer para novas respostas depois que você publicar novamente.
              Respostas já coletadas continuam vinculadas à versão em que foram respondidas.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
