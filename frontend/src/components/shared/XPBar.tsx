import { Zap } from 'lucide-react';
import { ProgressBar } from './ProgressBar';
import { cn } from '../../lib/cn';

interface XPBarProps {
  level: number;
  xpInLevel: number;
  xpToNext: number;
  progress: number; // 0..1
  className?: string;
}

export function XPBar({ level, xpInLevel, xpToNext, progress, className }: XPBarProps) {
  const totalInBand = xpInLevel + xpToNext;
  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-end justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-100 border border-primary-200 text-primary-700">
            <Zap className="h-4 w-4 fill-primary-500" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-surface-500">Level</p>
            <p className="text-xl font-bold leading-none text-surface-50">{level}</p>
          </div>
        </div>
        <p className="font-mono text-xs text-surface-400">
          <span className="text-xp-400">{xpInLevel}</span>
          <span className="text-surface-600"> / {totalInBand} XP</span>
        </p>
      </div>

      <ProgressBar
        value={progress}
        size="md"
      />

      <p className="text-xs text-surface-500">
        <span className="font-mono text-xp-400">{xpToNext}</span> XP to level {level + 1}
      </p>
    </div>
  );
}
