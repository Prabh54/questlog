import type { LucideIcon } from 'lucide-react';
import { Card } from '../ui/Card';
import { cn } from '../../lib/cn';

interface StatCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  tone?: 'default' | 'primary' | 'success' | 'warning' | 'xp';
  iconClassName?: string;
  className?: string;
}

const TONE_RING: Record<NonNullable<StatCardProps['tone']>, string> = {
  default: 'text-surface-400',
  primary: 'text-primary-400',
  success: 'text-success-400',
  warning: 'text-warning-400',
  xp: 'text-xp-400',
};

export function StatCard({
  label,
  value,
  subtitle,
  icon: Icon,
  tone = 'default',
  iconClassName,
  className,
}: StatCardProps) {
  return (
    <Card padding="md" className={cn('flex items-start justify-between gap-3', className)}>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium uppercase tracking-wide text-surface-500">{label}</p>
        <p className="mt-1 font-mono text-2xl font-bold text-surface-50 truncate">{value}</p>
        {subtitle && <p className="mt-0.5 text-xs text-surface-500 truncate">{subtitle}</p>}
      </div>
      {Icon && (
        <div className={cn('shrink-0 rounded-lg bg-surface-800 p-2', iconClassName ?? TONE_RING[tone])}>
          <Icon className="h-5 w-5" />
        </div>
      )}
    </Card>
  );
}
