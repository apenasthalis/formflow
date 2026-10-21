import { cn } from '@/lib/utils';

export function Logo({ className, compact = false, label = "FormFlow" }: { className?: string; compact?: boolean; label?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true" fill="currentColor">
          <ellipse cx="12" cy="9" rx="2.2" ry="5" />
          <ellipse cx="12" cy="9" rx="2.2" ry="5" transform="rotate(36 12 12)" />
          <ellipse cx="12" cy="9" rx="2.2" ry="5" transform="rotate(-36 12 12)" />
          <ellipse cx="12" cy="9" rx="2.2" ry="5" transform="rotate(72 12 12)" />
          <ellipse cx="12" cy="9" rx="2.2" ry="5" transform="rotate(-72 12 12)" />
          <ellipse cx="12" cy="15" rx="3.2" ry="2" />
        </svg>
      </span>
      {!compact ? (
        <span className="text-[15px] font-semibold tracking-tight">{label}</span>
      ) : null}
    </span>
  );
}