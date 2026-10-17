import { useEffect, useMemo, useRef } from 'react';
import { Check, Star } from 'lucide-react';
import { OTHER_OPTION_VALUE } from '@/utils/questions';
import { cn } from '@/lib/utils';
import type { AnswerValue, PublicQuestion } from '@/types';

/** Estilo compartilhado pelos campos de texto: resposta livre e "Outro". */
const TEXT_INPUT_CLASS =
  'w-full rounded-lg border border-input bg-background px-3 py-2 text-base outline-none transition-colors focus:border-primary';

type QuestionFieldProps = {
  question: PublicQuestion;
  answer: AnswerValue | undefined;
  error: string | undefined;
  disabled?: boolean;
  onChange: (value: AnswerValue) => void;
  /** Chamado por perguntas de resposta única para o avanço automático. */
  onAutoAdvance?: () => void;
};

/** Renderiza o controle de entrada de acordo com o tipo da pergunta. */
export function QuestionField({
  question,
  answer,
  error,
  disabled,
  onChange,
  onAutoAdvance,
}: QuestionFieldProps) {
  const inputRef = useRef<HTMLElement>(null);
  const settings = question.settings;

  // Todos os hooks são chamados incondicionalmente: os cálculos dependem do tipo
  // da pergunta, mas a ordem de execução permanece estável entre renderizações.
  const choiceOptions = useMemo(() => {
    const choice = settings as { options?: { value: string; label: string }[]; allowOther: boolean; otherLabel: string };
    const list = (choice.options ?? []).map((option) => ({
      value: option.value,
      label: option.label,
    }));
    if (choice.allowOther) {
      list.push({ value: OTHER_OPTION_VALUE, label: choice.otherLabel || 'Outro' });
    }
    return list;
  }, [settings]);

  const yesNoOptions = useMemo(() => {
    const labels = settings as { yesLabel: string; noLabel: string };
    return [
      { value: 'yes', label: labels.yesLabel || 'Sim' },
      { value: 'no', label: labels.noLabel || 'Não' },
    ];
  }, [settings]);

  const scaleValues = useMemo(() => {
    const scale = settings as { min: number; max: number };
    const list: number[] = [];
    for (let value = scale.min ?? 0; value <= (scale.max ?? 10); value += 1) list.push(value);
    return list;
  }, [settings]);

  const ratingValues = useMemo(() => {
    const rating = settings as { max: number };
    const list: number[] = [];
    for (let value = 1; value <= (rating.max ?? 5); value += 1) list.push(value);
    return list;
  }, [settings]);

  useEffect(() => {
    // Foco automático no campo principal, como esperado neste tipo de fluxo.
    const node = inputRef.current;
    if (!node) return;
    const timer = window.setTimeout(() => {
      node.focus();
      if (node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement) {
        node.select?.();
      }
    }, 60);
    return () => window.clearTimeout(timer);
  }, [question.key]);

  const otherText = answer?.text ?? '';
  const isOtherVisible = (settings as { allowOther?: boolean })?.allowOther ?? false;

  if (question.type === 'SHORT_TEXT' || question.type === 'LONG_TEXT' || question.type === 'EMAIL') {
    const text = settings as { placeholder: string; maxLength: number };
    const isLong = question.type === 'LONG_TEXT';
    const isEmail = question.type === 'EMAIL';
    const shared = {
      value: answer?.text ?? '',
      placeholder:
        text.placeholder ||
        (isEmail ? 'voce@exemplo.com' : isLong ? 'Digite sua resposta…' : 'Sua resposta'),
      maxLength: text.maxLength,
      disabled,
      onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        onChange({ questionKey: question.key, text: event.target.value }),
    };

    const field = isLong ? (
      <textarea
        {...shared}
        ref={inputRef as React.RefObject<HTMLTextAreaElement>}
        rows={4}
        className={cn(TEXT_INPUT_CLASS, 'resize-none')}
      />
    ) : (
      <input
        {...shared}
        ref={inputRef as React.RefObject<HTMLInputElement>}
        type={isEmail ? 'email' : 'text'}
        inputMode={isEmail ? 'email' : undefined}
        autoComplete={isEmail ? 'email' : undefined}
        autoCapitalize={isEmail ? 'none' : undefined}
        spellCheck={!isEmail}
        aria-invalid={isEmail ? Boolean(error) : undefined}
        className={cn(TEXT_INPUT_CLASS, isEmail && error && 'border-destructive')}
      />
    );

    return (
      <div className="space-y-2">
        {field}
        {error ? <FieldError message={error} /> : null}
      </div>
    );
  }

  if (question.type === 'YES_NO') {
    return (
      <ChoiceList
        questionKey={question.key}
        multiple={false}
        options={yesNoOptions}
        selected={answer?.value ? [String(answer.value)] : []}
        disabled={disabled}
        error={error}
        otherText={otherText}
        inputRef={inputRef}
        onChange={onChange}
        onAutoAdvance={onAutoAdvance}
      />
    );
  }

  if (question.type === 'SINGLE_CHOICE' || question.type === 'MULTIPLE_CHOICE') {
    const multiple = question.type === 'MULTIPLE_CHOICE';
    const selected = multiple ? (answer?.values ?? []) : answer?.value ? [String(answer.value)] : [];

    return (
      <div className="space-y-3">
        <ChoiceList
          questionKey={question.key}
          multiple={multiple}
          options={choiceOptions}
          selected={selected}
          disabled={disabled}
          error={error}
          otherText={otherText}
          inputRef={inputRef}
          onChange={onChange}
          onAutoAdvance={onAutoAdvance}
        />

        {isOtherVisible && selected.includes(OTHER_OPTION_VALUE) ? (
          <input
            value={otherText}
            onChange={(event) =>
              onChange({ ...answer, questionKey: question.key, text: event.target.value })
            }
            placeholder="Escreva sua resposta"
            disabled={disabled}
            className={TEXT_INPUT_CLASS}
            aria-label="Escreva sua resposta"
          />
        ) : null}
      </div>
    );
  }

  if (question.type === 'SCALE') {
    const scale = settings as { min: number; max: number; minLabel: string; maxLabel: string };
    const min = scale.min ?? 0;
    const max = scale.max ?? 10;

    return (
      <div className="space-y-3">
        <div
          className="flex flex-wrap gap-2"
          role="radiogroup"
          aria-label="Escala numérica"
          onKeyDown={(event) => {
            if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
            event.preventDefault();
            const current = Number(answer?.value ?? min);
            const next = event.key === 'ArrowRight' ? current + 1 : current - 1;
            onChange({ questionKey: question.key, value: Math.min(max, Math.max(min, next)) });
          }}
        >
          {scaleValues.map((value) => {
            const selected = Number(answer?.value) === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={disabled}
                onClick={() => {
                  onChange({ questionKey: question.key, value });
                  onAutoAdvance?.();
                }}
                className={cn(
                  'grid h-12 min-w-12 place-items-center rounded-lg border px-3 text-base font-medium transition-colors',
                  selected
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-input hover:border-foreground/40',
                )}
              >
                {value}
              </button>
            );
          })}
        </div>
        {scale.minLabel || scale.maxLabel ? (
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{scale.minLabel}</span>
            <span>{scale.maxLabel}</span>
          </div>
        ) : null}
        {error ? <FieldError message={error} /> : null}
      </div>
    );
  }

  if (question.type === 'RATING') {
    const rating = settings as { max: number; lowLabel: string; highLabel: string };
    const max = rating.max ?? 5;

    return (
      <div className="space-y-3">
        <div
          className="flex flex-wrap gap-2"
          role="radiogroup"
          aria-label="Nota"
          onKeyDown={(event) => {
            if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
            event.preventDefault();
            const current = Number(answer?.value ?? 0);
            const next = event.key === 'ArrowRight' ? current + 1 : current - 1;
            onChange({ questionKey: question.key, value: Math.min(max, Math.max(1, next)) });
          }}
        >
          {ratingValues.map((value) => {
            const selected = Number(answer?.value) === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={`Nota ${value}`}
                disabled={disabled}
                onClick={() => {
                  onChange({ questionKey: question.key, value });
                  onAutoAdvance?.();
                }}
                className={cn(
                  'grid h-12 w-12 place-items-center rounded-lg border text-base font-medium transition-colors',
                  selected
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-input hover:border-foreground/40',
                )}
              >
                {max > 5 ? value : <Star className="h-5 w-5" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
        {rating.lowLabel || rating.highLabel ? (
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{rating.lowLabel}</span>
            <span>{rating.highLabel}</span>
          </div>
        ) : null}
        {error ? <FieldError message={error} /> : null}
      </div>
    );
  }

  return null;
}

type ChoiceListProps = {
  questionKey: string;
  multiple: boolean;
  options: { value: string; label: string }[];
  selected: string[];
  disabled?: boolean;
  error?: string;
  otherText?: string;
  inputRef: React.RefObject<HTMLElement>;
  onChange: (value: AnswerValue) => void;
  onAutoAdvance?: () => void;
};

function ChoiceList({
  questionKey,
  multiple,
  options,
  selected,
  disabled,
  error,
  otherText,
  inputRef,
  onChange,
  onAutoAdvance,
}: ChoiceListProps) {
  const toggle = (value: string) => {
    if (multiple) {
      const wasSelected = selected.includes(value);
      const next = wasSelected ? selected.filter((item) => item !== value) : [...selected, value];
      // O texto livre de "Outro" só existe enquanto a alternativa estiver marcada.
      const text = next.includes(OTHER_OPTION_VALUE) ? (otherText || '') : undefined;
      onChange({ questionKey, values: next, text });
      return;
    }
    onChange({ questionKey, value, text: undefined });
    onAutoAdvance?.();
  };

  return (
    <div className="space-y-2" role={multiple ? 'group' : 'radiogroup'}>
      {options.map((option, index) => {
        const isSelected = selected.includes(option.value);

        return (
          <button
            key={option.value}
            ref={index === 0 ? (inputRef as React.RefObject<HTMLButtonElement>) : undefined}
            data-choice-option={index + 1}
            type="button"
            role={multiple ? 'checkbox' : 'radio'}
            aria-checked={isSelected}
            disabled={disabled}
            onClick={() => toggle(option.value)}
            className={cn(
              'flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors',
              isSelected
                ? 'border-primary bg-primary/5'
                : 'border-input hover:border-foreground/40 hover:bg-accent/40',
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                'grid h-6 w-6 shrink-0 place-items-center border text-xs font-semibold',
                multiple ? 'rounded-md' : 'rounded-full',
                isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-input',
              )}
            >
              {isSelected ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                String.fromCharCode(65 + index)
              )}
            </span>
            <span className="text-base">{option.label}</span>
          </button>
        );
      })}

      {error ? <FieldError message={error} /> : null}
    </div>
  );
}

function FieldError({ message }: { message: string }) {
  return (
    <p role="alert" className="text-sm font-medium text-destructive">
      {message}
    </p>
  );
}