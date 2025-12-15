import { cn } from '../../lib/cn';

interface ProgressBarProps {
  value: number; // 0..1
  className?: string;
  trackClassName?: string;
  barClassName?: string;
  size?: 'sm' | 'md' | 'lg';
}

const SIZE: Record<NonNullable<ProgressBarProps['size']>, string> = {
  sm: 'h-1',
  md: 'h-2',
  lg: 'h-3',
};

export function ProgressBar({
  value,
  className,
  trackClassName,
  barClassName,
  size = 'md',
}: ProgressBarProps) {
  const pct = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0)) * 100;
  return (
    <div
      className={cn(
        'w-full overflow-hidden rounded-full bg-surface-800',
        SIZE[size],
        trackClassName,
        className,
      )}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn(
          'h-full rounded-full bg-gradient-to-r from-primary-600 to-primary-400 transition-all duration-500',
          barClassName,
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
