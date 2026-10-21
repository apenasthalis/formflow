import { cn } from '@/lib/utils';

export function Logo({ className, compact = false, label = "FormFlow" }: { className?: string; compact?: boolean; label?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
        <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" aria-hidden="true" fill="none">
          <path
            d="M5 12.5 10 17.5 19 7"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      {!compact ? (
        <span className="text-[15px] font-semibold tracking-tight">{label}</span>
      ) : null}
    </span>
  );
}