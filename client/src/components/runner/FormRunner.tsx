import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CornerDownLeft, RotateCcw } from 'lucide-react';
import { QuestionField } from './QuestionField';
import { Spinner } from '@/components/ui/states';
import { Button } from '@/components/ui/button';
import { OTHER_OPTION_VALUE, isValidEmail, parseNumericAnswer } from '@/utils/questions';
import { createIdempotencyKey } from '@/utils/idempotency';
import { useFormDraft } from '@/hooks/useFormDraft';
import { cn } from '@/lib/utils';
import type { AnswerValue, PublicForm, PublicQuestion } from '@/types';

type Stage = 'welcome' | 'questions' | 'submitting' | 'done';

export type FormRunnerProps = {
  form: PublicForm;
  /** `preview` não fala com o servidor: usado dentro do editor. */
  mode?: 'live' | 'preview';
  onSubmit?: (payload: {
    answers: AnswerValue[];
    idempotencyKey: string;
    durationSeconds: number;
  }) => Promise<{ thankYouMessage?: string | null } | void>;
};

const TRANSITION = { duration: 0.24, ease: [0.22, 1, 0.36, 1] as const };

export function FormRunner({ form, mode = 'live', onSubmit }: FormRunnerProps) {
  const questions = useMemo(
    () => [...form.questions].sort((a, b) => a.position - b.position),
    [form.questions],
  );

  const { draft, ready, persist, clear, markSubmitted } = useFormDraft(
    mode === 'live' ? form.slug : undefined,
    form,
  );

  const [stage, setStage] = useState<Stage>('welcome');
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const startedAtRef = useRef<number>(Date.now());
  const idempotencyKeyRef = useRef<string>(draft?.idempotencyKey ?? createIdempotencyKey());
  const hydrated = useRef(false);

  // Recupera o progresso salvo (apenas na página pública). Aguarda a leitura
  // do rascunho terminar para não iniciar um novo preenchimento sem querer.
  useEffect(() => {
    if (!ready || hydrated.current || mode !== 'live') return;
    hydrated.current = true;
    if (!draft?.started) return;
    setAnswers(draft.answers);
    setIndex(Math.min(draft.index, Math.max(questions.length - 1, 0)));
    startedAtRef.current = draft.startedAt;
    setStage(draft.index > 0 || Object.keys(draft.answers).length > 0 ? 'questions' : 'welcome');
  }, [draft, ready, mode, questions.length]);

  const current = questions[index];
  const isSubmitting = stage === 'submitting';
  const total = questions.length;
  const progress = stage === 'questions' && total > 0 ? ((index + 1) / total) * 100 : 0;

  const saveDraft = useCallback(
    (nextAnswers: Record<string, AnswerValue>, nextIndex: number, started: boolean) => {
      if (mode !== 'live') return;
      persist({
        answers: nextAnswers,
        index: nextIndex,
        started,
        startedAt: startedAtRef.current,
        idempotencyKey: idempotencyKeyRef.current,
      });
    },
    [mode, persist],
  );

  const setAnswer = useCallback(
    (value: AnswerValue) => {
      setAnswers((previous) => {
        const next = { ...previous, [value.questionKey]: value };
        saveDraft(next, index, true);
        return next;
      });
      setErrors((previous) => {
        if (!previous[value.questionKey]) return previous;
        const next = { ...previous };
        delete next[value.questionKey];
        return next;
      });
    },
    [index, saveDraft],
  );

  const isAnswered = useCallback((question: PublicQuestion, answer: AnswerValue | undefined) => {
    if (!answer) return false;
    switch (question.type) {
      case 'SHORT_TEXT':
      case 'LONG_TEXT':
      case 'EMAIL':
      case 'NUMBER':
        return (answer.text ?? '').trim() !== '';
      case 'SINGLE_CHOICE':
      case 'YES_NO':
      case 'SCALE':
      case 'RATING':
        return answer.value !== undefined && answer.value !== null && String(answer.value) !== '';
      case 'MULTIPLE_CHOICE':
        return (answer.values ?? []).length > 0;
      default:
        return false;
    }
  }, []);

  const validate = useCallback(
    (question: PublicQuestion): string | null => {
      const answer = answers[question.key];
      const answered = isAnswered(question, answer);

      if (answered) {
        if (question.type === 'EMAIL' && !isValidEmail(answer?.text ?? '')) {
          return 'Informe um e-mail válido.';
        }
        if (question.type === 'NUMBER' && parseNumericAnswer(answer?.text ?? '') === null) {
          return 'Informe apenas números.';
        }
        if (question.type === 'SINGLE_CHOICE' || question.type === 'MULTIPLE_CHOICE') {
          const usesOther =
            question.type === 'MULTIPLE_CHOICE'
              ? (answer?.values ?? []).includes(OTHER_OPTION_VALUE)
              : String(answer?.value) === OTHER_OPTION_VALUE;
          const settings = question.settings as { allowOther: boolean };
          if (usesOther && settings.allowOther && (answer?.text ?? '').trim() === '') {
            return 'Descreva sua resposta ou escolha outra alternativa.';
          }
        }
        return null;
      }

      if (question.required) {
        return question.errorMessage?.trim() || 'Esta pergunta é obrigatória.';
      }

      // Pergunta opcional respondida só pela digitação: evita gravar vazios.
      return null;
    },
    [answers, isAnswered],
  );

  const goNext = useCallback(() => {
    if (!current) return;
    const error = validate(current);
    if (error) {
      setErrors((previous) => ({ ...previous, [current.key]: error }));
      return;
    }

    const answer = answers[current.key];
    const shouldPersistAnswer = isAnswered(current, answer);

    if (index < total - 1) {
      const nextIndex = index + 1;
      setDirection(1);
      setIndex(nextIndex);
      const nextAnswers = { ...answers };
      if (!shouldPersistAnswer) delete nextAnswers[current.key];
      saveDraft(nextAnswers, nextIndex, true);
      return;
    }

    void finish(nextAnswersAfterFinal(answers, current, shouldPersistAnswer));
  }, [answers, current, index, isAnswered, saveDraft, total, validate]);

  const goBack = useCallback(() => {
    if (index === 0) {
      setDirection(-1);
      setStage('welcome');
      saveDraft(answers, 0, true);
      return;
    }
    setDirection(-1);
    setIndex((value) => {
      const nextIndex = value - 1;
      saveDraft(answers, nextIndex, true);
      return nextIndex;
    });
  }, [answers, index, saveDraft]);

  // Refs mantêm o handlers mais recente sem recriar os callbacks de teclado.
  const goNextRef = useRef(goNext);
  goNextRef.current = goNext;
  const goBackRef = useRef(goBack);
  goBackRef.current = goBack;

  /**
   * Avança sozinho após a seleção em perguntas de resposta única.
   * Usa uma ref para enxergar a resposta recém-marcada no momento do avanço.
   */
  const autoAdvance = useCallback(() => {
    const timer = window.setTimeout(() => goNextRef.current(), 280);
    return () => window.clearTimeout(timer);
  }, []);

  const finish = useCallback(
    async (finalAnswers: Record<string, AnswerValue>) => {
      setStage('submitting');
      setSubmitError(null);

      const durationSeconds = Math.max(
        1,
        Math.round((Date.now() - startedAtRef.current) / 1000),
      );

      const payload = {
        answers: questions
          .map((question) => finalAnswers[question.key])
          .filter((answer): answer is AnswerValue => Boolean(answer)),
        idempotencyKey: idempotencyKeyRef.current,
        durationSeconds,
      };

      try {
        await onSubmit?.(payload);
        if (mode === 'live') {
          clear();
          markSubmitted();
        }
        setStage('done');
      } catch (error) {
        setSubmitError(
          error instanceof Error
            ? error.message
            : 'Não foi possível enviar suas respostas. Tente novamente.',
        );
        setStage('questions');
        if (mode === 'live') saveDraft(finalAnswers, index, true);
      }
    },
    [clear, index, markSubmitted, mode, onSubmit, questions, saveDraft],
  );

  const start = useCallback(() => {
    // Uma nova tentativa descarta o rascunho (e a marcação) da resposta anterior.
    clear();
    startedAtRef.current = Date.now();
    idempotencyKeyRef.current = createIdempotencyKey();
    setAnswers({});
    setErrors({});
    setIndex(0);
    setDirection(1);
    setStage('questions');
    saveDraft({}, 0, true);
  }, [clear, saveDraft]);

  const restart = useCallback(() => {
    idempotencyKeyRef.current = createIdempotencyKey();
    setAnswers({});
    setErrors({});
    setIndex(0);
    setDirection(-1);
    setStage('welcome');
    if (mode === 'live') clear();
  }, [clear, mode]);

  /* Atalhos de teclado --------------------------------------------------- */
  useEffect(() => {
    if (stage !== 'questions') return;

    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      const inField = tag === 'INPUT' || tag === 'TEXTAREA';

      if (event.key === 'Enter') {
        // Em texto longo, Shift+Enter insere uma nova linha.
        if (tag === 'TEXTAREA' && event.shiftKey) return;
        event.preventDefault();
        void goNextRef.current();
        return;
      }

      if (event.key === 'ArrowLeft' && event.altKey) {
        event.preventDefault();
        goBackRef.current();
        return;
      }

      // Atalhos 1–9 para alternativas de escolha.
      if (!inField && /^[1-9]$/.test(event.key) && current) {
        if (
          current.type === 'SINGLE_CHOICE' ||
          current.type === 'MULTIPLE_CHOICE' ||
          current.type === 'YES_NO'
        ) {
          event.preventDefault();
          const node = document.querySelectorAll<HTMLButtonElement>('[data-choice-option]');
          const option = node[Number(event.key) - 1];
          option?.click();
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [stage, current]);

  /* Renderização --------------------------------------------------------- */

  return (
    <div className="flex min-h-full flex-col bg-background">
      <ProgressBar progress={progress} />

      <div className="flex flex-1 items-center justify-center px-5 py-10 sm:px-8 sm:py-16">
        <div className="w-full max-w-2xl">
          <AnimatePresence mode="wait" initial={false} custom={direction}>
            <motion.div
              key={stage === 'questions' ? `q-${current?.key ?? index}` : stage}
              custom={direction}
              initial={{ opacity: 0, y: direction > 0 ? 28 : -28 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: direction > 0 ? -28 : 28 }}
              transition={TRANSITION}
            >
              {stage === 'welcome' ? (
                <WelcomeScreen
                  form={form}
                  questionCount={questions.length}
                  onStart={start}
                  preview={mode === 'preview'}
                />
              ) : null}

              {stage === 'questions' && current ? (
                <section aria-live="polite">
                  <p className="text-sm font-medium text-primary">
                    {index + 1} <span className="text-muted-foreground">→</span>
                  </p>
                  <h1 className="mt-2 text-xl font-semibold leading-snug tracking-tight sm:text-2xl">
                    {current.title}
                    {current.required ? (
                      <span className="ml-1 text-primary" aria-hidden="true">
                        *
                      </span>
                    ) : null}
                  </h1>
                  {current.description ? (
                    <p className="mt-2 text-sm text-muted-foreground">{current.description}</p>
                  ) : null}

                  <div className="mt-7">
                    <QuestionField
                      key={current.key}
                      question={current}
                      answer={answers[current.key]}
                      error={errors[current.key]}
                      disabled={isSubmitting}
                      onChange={setAnswer}
                      onAutoAdvance={autoAdvance}
                    />
                  </div>

                  {submitError ? (
                    <p role="alert" className="mt-4 text-sm font-medium text-destructive">
                      {submitError}
                    </p>
                  ) : null}

                  <div className="mt-8 flex items-center gap-2">
                    <Button type="button" onClick={() => void goNext()} disabled={isSubmitting}>
                      {index === total - 1 ? 'Enviar' : 'OK'}
                      <CornerDownLeft className="h-3.5 w-3.5 opacity-70" aria-hidden="true" />
                      <kbd className="ml-1 hidden text-[10px] font-medium opacity-60 sm:inline">Enter ↵</kbd>
                    </Button>

                    <Button type="button" variant="ghost" onClick={goBack}>
                      {index === 0 ? 'Voltar ao início' : 'Voltar'}
                    </Button>

                    {mode === 'preview' ? (
                      <span className="ml-auto text-xs text-muted-foreground">
                        Pré-visualização: nenhuma resposta é enviada.
                      </span>
                    ) : (
                      <span className="ml-auto hidden text-xs text-muted-foreground sm:block">
                        Pressione <kbd className="rounded bg-muted px-1">Enter ↵</kbd> para continuar
                      </span>
                    )}
                  </div>

                </section>
              ) : null}

              {stage === 'submitting' ? (
                <div className="flex flex-col items-center gap-3 py-20 text-muted-foreground">
                  <Spinner className="h-5 w-5" />
                  <p className="text-sm">Enviando suas respostas…</p>
                </div>
              ) : null}

              {stage === 'done' ? (
                <ThankYouScreen
                  message={form.thankYouMessage}
                  onRestart={restart}
                  preview={mode === 'preview'}
                />
              ) : null}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <footer className="pb-6 pt-2 text-center text-xs text-muted-foreground">
        {mode === 'preview' ? (
          <span>FormFlow · prévia do formulário</span>
        ) : (
          <span>
            Progresso salvo{' '}
            <span className="font-medium text-foreground">
              {Math.min(index + 1, total)} de {total}
            </span>
          </span>
        )}
      </footer>
    </div>
  );
}

function nextAnswersAfterFinal(
  answers: Record<string, AnswerValue>,
  question: PublicQuestion,
  keep: boolean,
): Record<string, AnswerValue> {
  if (keep) return answers;
  const next = { ...answers };
  delete next[question.key];
  return next;
}

function ProgressBar({ progress }: { progress: number }) {
  return (
    <div className="h-1 w-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}>
      <motion.div
        className="h-full bg-primary"
        initial={false}
        animate={{ width: `${progress}%` }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
      />
    </div>
  );
}

function WelcomeScreen({
  form,
  questionCount,
  onStart,
  preview,
}: {
  form: PublicForm;
  questionCount: number;
  onStart: () => void;
  preview: boolean;
}) {
  return (
    <section>
      <h1 className="text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
        {form.title}
      </h1>
      {form.description ? (
        <p className="mt-3 text-base leading-relaxed text-muted-foreground">{form.description}</p>
      ) : null}
      {form.welcomeMessage ? (
        <p className="mt-3 text-base leading-relaxed text-muted-foreground">{form.welcomeMessage}</p>
      ) : null}

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Button size="lg" onClick={onStart}>
          Começar
          <CornerDownLeft className="h-4 w-4 opacity-70" aria-hidden="true" />
        </Button>
        <p className="text-xs text-muted-foreground">
          {questionCount} {questionCount === 1 ? 'pergunta' : 'perguntas'}
          {preview ? ' · este é um teste de prévia' : ''}
        </p>
      </div>
    </section>
  );
}

function ThankYouScreen({
  message,
  onRestart,
  preview,
}: {
  message: string | null;
  onRestart: () => void;
  preview: boolean;
}) {
  return (
    <section className="py-6 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden="true">
          <path
            d="M5 12.5 10 17.5 19 7"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <h1 className={cn('mt-5 text-2xl font-semibold tracking-tight')}>Respostas enviadas</h1>
      <p className="mx-auto mt-3 max-w-lg text-base leading-relaxed text-muted-foreground">
        {message || 'Obrigado por participar — suas respostas foram registradas.'}
      </p>

      {!preview ? (
        <Button variant="outline" className="mt-7" onClick={onRestart}>
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          Enviar outra resposta
        </Button>
      ) : null}
    </section>
  );
}