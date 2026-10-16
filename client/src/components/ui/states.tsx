import { Loader2, Inbox } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('h-4 w-4 animate-spin', className)} aria-hidden="true" />;
}

export function LoadingState({ label = 'Carregando…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
      <Spinner />
      <span>{label}</span>
    </div>
  );
}

type EmptyStateProps = {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({ title, description, icon, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-14 text-center',
        className,
      )}
    >
      <div className="mb-4 rounded-full bg-muted p-3 text-muted-foreground">
        {icon ?? <Inbox className="h-5 w-5" aria-hidden="true" />}
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      {description ? (
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

/** Banner de erro com ação opcional de retentativa. */
export function ErrorState({
  title = 'Não foi possível carregar',
  description,
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-red-100 bg-red-50/60 px-6 py-12 text-center">
      <h3 className="text-base font-semibold text-red-900">{title}</h3>
      {description ? <p className="mt-1 text-sm text-red-700">{description}</p> : null}
      {onRetry ? (
        <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
          Tentar novamente
        </Button>
      ) : null}
    </div>
  );
}