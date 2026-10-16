import { useCallback, useEffect, useState } from 'react';
import type { AnswerValue, PublicForm } from '@/types';

const DRAFT_PREFIX = 'formflow:draft:';
const SUBMITTED_PREFIX = 'formflow:submitted:';

export type FormDraft = {
  answers: Record<string, AnswerValue>;
  index: number;
  started: boolean;
  startedAt: number;
  idempotencyKey: string;
};

function storageKey(slug: string) {
  return `${DRAFT_PREFIX}${slug}`;
}

function canUseStorage(): boolean {
  try {
    return typeof window !== 'undefined' && 'localStorage' in window;
  } catch {
    return false;
  }
}

/**
 * Recupera o progresso de uma resposta no navegador.
 * O rascunho é apenas uma commodidade: o servidor continua sendo a fonte de
 * verdade e nenhuma resposta é considered salva antes do envio final.
 */
export function useFormDraft(slug: string | undefined, form: PublicForm | undefined) {
  const [draft, setDraft] = useState<FormDraft | null>(null);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  /** Indica que a leitura do rascunho terminou (mesmo quando não existe um). */
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setAlreadySubmitted(false);
    setReady(false);
    if (!slug || !form || !canUseStorage()) return;

    let parsed: FormDraft | null = null;
    try {
      const raw = window.localStorage.getItem(storageKey(slug));
      if (raw) {
        const candidate = JSON.parse(raw) as FormDraft;
        // Descarta rascunhos de versões diferentes do formulário.
        const validKeys = new Set(form.questions.map((question) => question.key));
        const answers = Object.fromEntries(
          Object.entries(candidate.answers ?? {}).filter(([key]) => validKeys.has(key)),
        );
        parsed = {
          answers,
          index: Math.max(0, Math.min(candidate.index ?? 0, form.questions.length)),
          started: Boolean(candidate.started),
          startedAt: Number(candidate.startedAt) || Date.now(),
          idempotencyKey: candidate.idempotencyKey,
        };
      }
    } catch {
      parsed = null;
    }

    // Se já concluiu antes, o rascunho não deve reabrir a resposta automaticamente.
    const submittedBefore = (() => {
      try {
        return window.localStorage.getItem(`${SUBMITTED_PREFIX}${slug}`) === 'true';
      } catch {
        return false;
      }
    })();

    setDraft(parsed ? { ...parsed, started: parsed.started && !submittedBefore } : null);
    setAlreadySubmitted(submittedBefore);
    setReady(true);
  }, [slug, form]);

  const persist = useCallback(
    (next: FormDraft) => {
      setDraft(next);
      if (!slug || !canUseStorage()) return;
      try {
        window.localStorage.setItem(storageKey(slug), JSON.stringify(next));
      } catch {
        // Armazenamento indisponível (modo privado): seguimos sem recuperar.
      }
    },
    [slug],
  );

  const clear = useCallback(() => {
    setDraft(null);
    if (!slug || !canUseStorage()) return;
    try {
      window.localStorage.removeItem(storageKey(slug));
      window.localStorage.removeItem(`${SUBMITTED_PREFIX}${slug}`);
    } catch {
      // ignora
    }
  }, [slug]);

  const markSubmitted = useCallback(() => {
    if (!slug || !canUseStorage()) return;
    try {
      window.localStorage.setItem(`${SUBMITTED_PREFIX}${slug}`, 'true');
    } catch {
      // ignora
    }
  }, [slug]);

  return { draft, ready, alreadySubmitted, persist, clear, markSubmitted };
}