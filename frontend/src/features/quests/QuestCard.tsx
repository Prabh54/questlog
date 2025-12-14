import { Link } from 'react-router-dom';
import { Flame, Check, Pencil, Archive, ArchiveRestore } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge, DIFFICULTY_BADGE } from '../../components/ui/Badge';
import { cn } from '../../lib/cn';
import type { Quest } from '../../services/quests.api';

interface QuestCardProps {
  quest: Quest;
  onComplete?: (quest: Quest) => void;
  onArchive?: (quest: Quest) => void;
  onUnarchive?: (quest: Quest) => void;
  completing?: boolean;
}

export function QuestCard({ quest, onComplete, onArchive, onUnarchive, completing }: QuestCardProps) {
  const isArchived = quest.status === 'ARCHIVED';
  const completedToday = quest.strip[quest.strip.length - 1]?.completed ?? false;

  return (
    <Card
      className={cn(
        'flex flex-col gap-4 transition-all hover:border-primary-700/50',
        isArchived && 'opacity-60',
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <Link
            to={`/quests/${quest.id}`}
            className="block font-semibold text-surface-50 hover:text-primary-300 truncate"
          >
            {quest.title}
          </Link>
          {quest.description && (
            <p className="mt-1 text-xs text-surface-400 line-clamp-2">{quest.description}</p>
          )}
        </div>
        {quest.streak > 0 && (
          <span className="flex items-center gap-1 text-xs font-medium text-orange-400 shrink-0">
            <Flame className="h-3.5 w-3.5 fill-orange-400" />
            {quest.streak}
          </span>
        )}
      </div>

      {/* Meta badges */}
      <div className="flex flex-wrap items-center gap-1.5">
        {quest.category && (
          <Badge
            size="sm"
            style={{
              backgroundColor: `${quest.category.color}20`,
              color: quest.category.color,
              borderColor: `${quest.category.color}40`,
              borderWidth: 1,
              borderStyle: 'solid',
            }}
          >
            {quest.category.name}
          </Badge>
        )}
        <Badge size="sm" variant={DIFFICULTY_BADGE[quest.difficulty]}>
          {quest.difficulty}
        </Badge>
        <Badge size="sm" variant="xp">
          +{quest.xp_reward} XP
        </Badge>
        <Badge size="sm" variant="default">
          {quest.frequency.toLowerCase()}
        </Badge>
      </div>

      {/* 14-day consistency strip */}
      <div className="flex gap-1">
        {quest.strip.map((day) => (
          <div
            key={day.date}
            title={`${day.date}: ${day.completed ? 'completed' : 'no entry'}`}
            className={cn(
              'h-2 flex-1 rounded-sm',
              day.completed ? 'bg-success-500' : 'bg-surface-800',
            )}
          />
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        {!isArchived && (
          <Button
            size="sm"
            variant={completedToday ? 'secondary' : 'primary'}
            className="flex-1"
            disabled={completedToday}
            loading={completing}
            onClick={() => onComplete?.(quest)}
          >
            <Check className="h-3.5 w-3.5" />
            {completedToday ? 'Done today' : 'Complete'}
          </Button>
        )}
        <Link to={`/quests/${quest.id}/edit`} className="contents">
          <Button size="sm" variant="secondary">
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Button>
        </Link>
        {isArchived ? (
          <Button size="sm" variant="ghost" onClick={() => onUnarchive?.(quest)}>
            <ArchiveRestore className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => onArchive?.(quest)}>
            <Archive className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </Card>
  );
}
