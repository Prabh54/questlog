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
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-600/20 border border-primary-600/40 text-primary-300">
            <Zap className="h-4 w-4 fill-primary-400" />
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
        barClassName="bg-gradient-to-r from-primary-600 via-primary-400 to-xp-400"
      />

      <p className="text-xs text-surface-500">
        <span className="font-mono text-xp-400">{xpToNext}</span> XP to level {level + 1}
      </p>
    </div>
  );
}
