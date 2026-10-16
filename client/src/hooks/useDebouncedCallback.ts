import { useCallback, useEffect, useRef } from 'react';

/** Versão estável de um callback com atraso (usado no salvamento automático). */
export function useDebouncedCallback<TArgs extends unknown[]>(
  callback: (...args: TArgs) => void,
  delay = 600,
) {
  const timerRef = useRef<number | null>(null);
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(
    () => () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    },
    [],
  );

  const debounced = useCallback(
    (...args: TArgs) => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => callbackRef.current(...args), delay);
    },
    [delay],
  );

  const flush = useCallback((...args: TArgs) => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    callbackRef.current(...args);
  }, []);

  const cancel = useCallback(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  return { debounced, flush, cancel };
}