import { Badge, type BadgeProps } from '@/components/ui/badge';
import { FORM_STATUS_LABEL } from '@/utils/questions';
import type { FormStatus } from '@/types';
import { cn } from '@/lib/utils';

const VARIANTS: Record<FormStatus, BadgeProps['variant']> = {
  DRAFT: 'success',
  PUBLISHED: 'default',
  ARCHIVED: 'outline',
};

const DOT: Record<FormStatus, string> = {
  DRAFT: 'bg-emerald-500',
  PUBLISHED: 'bg-primary',
  ARCHIVED: 'bg-muted-foreground',
};

export function FormStatusBadge({ status, className }: { status: FormStatus; className?: string }) {
  return (
    <Badge variant={VARIANTS[status]} className={className}>
      <span className={cn('h-1.5 w-1.5 rounded-full', DOT[status])} aria-hidden="true" />
      {FORM_STATUS_LABEL[status]}
    </Badge>
  );
}