import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { create } from 'zustand';
import { cn } from '@/lib/utils';

type ToastKind = 'success' | 'error' | 'info';

type ToastItem = {
  id: number;
  kind: ToastKind;
  message: string;
};

type ToastStore = {
  toasts: ToastItem[];
  push: (kind: ToastKind, message: string) => void;
  dismiss: (id: number) => void;
};

let nextId = 1;

const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  push: (kind, message) => {
    const id = nextId++;
    set((state) => ({ toasts: [...state.toasts, { id, kind, message }] }));
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) }));
    }, 5000);
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
}));

export const toast = {
  success: (message: string) => useToastStore.getState().push('success', message),
  error: (message: string) => useToastStore.getState().push('error', message),
  info: (message: string) => useToastStore.getState().push('info', message),
};

const ICONS = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
} as const;

export function Toaster() {
  const toasts = useToastStore((state) => state.toasts);
  const dismiss = useToastStore((state) => state.dismiss);

  return (
    <div
      className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2"
      role="status"
      aria-live="polite"
    >
      <AnimatePresence initial={false}>
        {toasts.map((item) => {
          const Icon = ICONS[item.kind];
          return (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 24, scale: 0.98 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className={cn(
                'pointer-events-auto flex items-start gap-3 rounded-lg border bg-background p-3 text-sm shadow-lg',
                item.kind === 'error' && 'border-red-100',
                item.kind === 'success' && 'border-emerald-100',
              )}
            >
              <Icon
                className={cn(
                  'mt-0.5 h-4 w-4 shrink-0',
                  item.kind === 'success' && 'text-emerald-600',
                  item.kind === 'error' && 'text-destructive',
                  item.kind === 'info' && 'text-primary',
                )}
                aria-hidden="true"
              />
              <p className="flex-1 leading-snug">{item.message}</p>
              <button
                type="button"
                onClick={() => dismiss(item.id)}
                className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                aria-label="Fechar aviso"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}