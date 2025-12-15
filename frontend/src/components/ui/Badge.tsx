import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/cn';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full font-medium',
  {
    variants: {
      variant: {
        default: 'bg-surface-700 text-surface-200',
        primary: 'bg-primary-600/20 text-primary-300 border border-primary-600/30',
        success: 'bg-success-500/20 text-success-400 border border-success-500/30',
        warning: 'bg-warning-500/20 text-warning-400 border border-warning-500/30',
        danger: 'bg-danger-500/20 text-danger-400 border border-danger-500/30',
        xp: 'bg-xp-500/20 text-xp-400 border border-xp-500/30',
      },
      size: {
        sm: 'px-2 py-0.5 text-xs',
        md: 'px-2.5 py-1 text-xs',
        lg: 'px-3 py-1 text-sm',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, size, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant, size }), className)} {...props} />;
}

// Convenience maps for domain enums
export const DIFFICULTY_BADGE: Record<string, BadgeProps['variant']> = {
  EASY: 'success',
  MEDIUM: 'warning',
  HARD: 'danger',
  LEGENDARY: 'primary',
};

export const STATUS_BADGE: Record<string, BadgeProps['variant']> = {
  ACTIVE: 'primary',
  PAUSED: 'default',
  COMPLETED: 'success',
  ARCHIVED: 'default',
};
