import { cn } from '@/lib/utils';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase();
}

const PALETTE = [
  'bg-indigo-100 text-indigo-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-sky-100 text-sky-700',
  'bg-rose-100 text-rose-700',
];

export function Avatar({ name, className }: { name: string; className?: string }) {
  const label = initials(name);
  const palette = PALETTE[label.charCodeAt(0) % PALETTE.length];

  return (
    <span
      aria-hidden="true"
      className={cn(
        'grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-semibold',
        palette,
        className,
      )}
    >
      {label}
    </span>
  );
}