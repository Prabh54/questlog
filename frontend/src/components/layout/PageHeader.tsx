import { cn } from '../../lib/cn';

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, description, action, className }: PageHeaderProps) {
  return (
    <div className={cn('mb-8 flex items-start justify-between gap-4', className)}>
      <div>
        <h1 className="text-2xl font-bold text-surface-50 tracking-tight">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-surface-400 text-balance">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
