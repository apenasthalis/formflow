import { GripVertical, Plus, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import {
  asChoiceSettings,
  asRatingSettings,
  asScaleSettings,
  asTextSettings,
  asYesNoSettings,
  makeOptionValue,
} from '@/utils/questions';
import type { Question, QuestionSettings } from '@/types';

/**
 * Campos de configuração que dependem do tipo da pergunta.
 *
 * `onChange` recebe um atualizador funcional para que edições em sequência
 * rápida partam sempre do valor mais recente, e não de uma props defasada.
 */
export function TypeSettingsFields({
  question,
  onChange,
  disabled,
}: {
  question: Question;
  onChange: (updater: (settings: QuestionSettings) => QuestionSettings) => void;
  disabled?: boolean;
}) {
  if (question.type === 'SHORT_TEXT' || question.type === 'LONG_TEXT') {
    const settings = asTextSettings(question.settings);
    return (
      <div className="space-y-4">
        <Field label="Texto de exemplo" htmlFor="placeholder">
          <Input
            id="placeholder"
            value={settings.placeholder}
            disabled={disabled}
            placeholder="Ex.: Digite sua resposta"
            onChange={(event) =>
              onChange((previous) => ({ ...asTextSettings(previous), placeholder: event.target.value }))
            }
          />
        </Field>
        <Field label="Limite de caracteres" htmlFor="maxLength">
          <Input
            id="maxLength"
            type="number"
            min={1}
            max={5000}
            value={settings.maxLength}
            disabled={disabled}
            onChange={(event) =>
              onChange((previous) => ({
                ...asTextSettings(previous),
                maxLength: Number(event.target.value) || 1,
              }))
            }
          />
        </Field>
      </div>
    );
  }

  if (question.type === 'YES_NO') {
    const settings = asYesNoSettings(question.settings);
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Rótulo de “sim”" htmlFor="yesLabel">
          <Input
            id="yesLabel"
            value={settings.yesLabel}
            disabled={disabled}
            onChange={(event) =>
              onChange((previous) => ({
                ...asYesNoSettings(previous),
                yesLabel: event.target.value,
              }))
            }
          />
        </Field>
        <Field label="Rótulo de “não”" htmlFor="noLabel">
          <Input
            id="noLabel"
            value={settings.noLabel}
            disabled={disabled}
            onChange={(event) =>
              onChange((previous) => ({
                ...asYesNoSettings(previous),
                noLabel: event.target.value,
              }))
            }
          />
        </Field>
      </div>
    );
  }

  if (question.type === 'SINGLE_CHOICE' || question.type === 'MULTIPLE_CHOICE') {
    const settings = asChoiceSettings(question.settings);
    const options = settings.options ?? [];

    const updateOption = (index: number, label: string) => {
      onChange((previous) => {
        const current = asChoiceSettings(previous).options;
        return {
          ...asChoiceSettings(previous),
          options: current.map((option, position) =>
            position === index ? { ...option, label } : option,
          ),
        };
      });
    };

    const removeOption = (index: number) => {
      if (options.length <= 1) return;
      onChange((previous) => ({
        ...asChoiceSettings(previous),
        options: asChoiceSettings(previous).options.filter((_, position) => position !== index),
      }));
    };

    const moveOption = (index: number, direction: -1 | 1) => {
      onChange((previous) => {
        const current = asChoiceSettings(previous).options;
        const target = index + direction;
        if (target < 0 || target >= current.length) return previous;
        const next = [...current];
        const [item] = next.splice(index, 1);
        next.splice(target, 0, item!);
        return { ...asChoiceSettings(previous), options: next };
      });
    };

    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Alternativas</Label>
          <ul className="space-y-2">
            {options.map((option, index) => (
              <li key={option.value} className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-muted text-xs font-semibold text-muted-foreground"
                >
                  {String.fromCharCode(65 + index)}
                </span>
                <Input
                  value={option.label}
                  disabled={disabled}
                  aria-label={`Alternativa ${index + 1}`}
                  placeholder={`Alternativa ${index + 1}`}
                  onChange={(event) => updateOption(index, event.target.value)}
                />
                <div className="flex flex-col">
                  <button
                    type="button"
                    className="rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-40"
                    aria-label="Mover alternativa para cima"
                    disabled={index === 0}
                    onClick={() => moveOption(index, -1)}
                  >
                    <GripVertical className="h-3.5 w-3.5 rotate-90" />
                  </button>
                  <button
                    type="button"
                    className="rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-40"
                    aria-label="Mover alternativa para baixo"
                    disabled={index === options.length - 1}
                    onClick={() => moveOption(index, 1)}
                  >
                    <GripVertical className="h-3.5 w-3.5 -rotate-90" />
                  </button>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={disabled || options.length <= 1}
                  aria-label={`Remover alternativa ${index + 1}`}
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => removeOption(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
          <Button
            variant="outline"
            size="sm"
            disabled={disabled || options.length >= 30}
            onClick={() =>
              onChange((previous) => {
                const current = asChoiceSettings(previous).options;
                return {
                  ...asChoiceSettings(previous),
                  options: [
                    ...current,
                    { value: makeOptionValue(), label: `Alternativa ${current.length + 1}` },
                  ],
                };
              })
            }
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Adicionar alternativa
          </Button>
        </div>

        <ToggleRow
          id="allowOther"
          label="Permitir resposta “outro”"
          description="O participante pode escrever uma alternativa livre."
          checked={settings.allowOther}
          disabled={disabled}
          onChange={(checked) => onChange((previous) => ({ ...asChoiceSettings(previous), allowOther: checked }))}
        />

        {settings.allowOther ? (
          <Field label="Rótulo da alternativa livre" htmlFor="otherLabel">
            <Input
              id="otherLabel"
              value={settings.otherLabel}
              disabled={disabled}
              onChange={(event) =>
                onChange((previous) => ({ ...asChoiceSettings(previous), otherLabel: event.target.value }))
              }
            />
          </Field>
        ) : null}
      </div>
    );
  }

  if (question.type === 'SCALE') {
    const settings = asScaleSettings(question.settings);
    const min = settings.min ?? 0;
    const max = Math.max((settings.max ?? 10), (settings.min ?? 0) + 1);

    return (
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Valor mínimo" htmlFor="scaleMin">
            <Input
              id="scaleMin"
              type="number"
              min={0}
              max={99}
              value={min}
              disabled={disabled}
              onChange={(event) =>
                onChange((previous) => {
                  const current = asScaleSettings(previous);
                  return { ...current, min: Math.min(Number(event.target.value) || 0, max - 1) };
                })
              }
            />
          </Field>
          <Field label="Valor máximo" htmlFor="scaleMax">
            <Input
              id="scaleMax"
              type="number"
              min={1}
              max={101}
              value={max}
              disabled={disabled}
              onChange={(event) =>
                onChange((previous) => {
                  const current = asScaleSettings(previous);
                  return { ...current, max: Math.max(Number(event.target.value) || 1, min + 1) };
                })
              }
            />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Rótulo do mínimo" htmlFor="scaleMinLabel">
            <Input
              id="scaleMinLabel"
              value={settings.minLabel}
              disabled={disabled}
              placeholder="Ex.: Ruim"
              onChange={(event) =>
                onChange((previous) => ({ ...asScaleSettings(previous), minLabel: event.target.value }))
              }
            />
          </Field>
          <Field label="Rótulo do máximo" htmlFor="scaleMaxLabel">
            <Input
              id="scaleMaxLabel"
              value={settings.maxLabel}
              disabled={disabled}
              placeholder="Ex.: Excelente"
              onChange={(event) =>
                onChange((previous) => ({ ...asScaleSettings(previous), maxLabel: event.target.value }))
              }
            />
          </Field>
        </div>
      </div>
    );
  }

  if (question.type === 'RATING') {
    const settings = asRatingSettings(question.settings);
    const max = settings.max ?? 5;

    return (
      <div className="space-y-4">
        <Field label="Quantidade de níveis" htmlFor="ratingMax">
          <Input
            id="ratingMax"
            type="number"
            min={3}
            max={10}
            value={max}
            disabled={disabled}
            onChange={(event) =>
              onChange((previous) => ({
                ...asRatingSettings(previous),
                max: Math.min(10, Math.max(3, Number(event.target.value) || 5)),
              }))
            }
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Rótulo do mínimo" htmlFor="ratingLow">
            <Input
              id="ratingLow"
              value={settings.lowLabel}
              disabled={disabled}
              placeholder="Ex.: Ruim"
              onChange={(event) =>
                onChange((previous) => ({ ...asRatingSettings(previous), lowLabel: event.target.value }))
              }
            />
          </Field>
          <Field label="Rótulo do máximo" htmlFor="ratingHigh">
            <Input
              id="ratingHigh"
              value={settings.highLabel}
              disabled={disabled}
              placeholder="Ex.: Excelente"
              onChange={(event) =>
                onChange((previous) => ({ ...asRatingSettings(previous), highLabel: event.target.value }))
              }
            />
          </Field>
        </div>
      </div>
    );
  }

  return null;
}

export function Field({
  label,
  htmlFor,
  children,
  hint,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function ToggleRow({
  id,
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-0.5">
        <Label htmlFor={id}>{label}</Label>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </div>
      <Switch id={id} checked={checked} disabled={disabled} onCheckedChange={onChange} />
    </div>
  );
}