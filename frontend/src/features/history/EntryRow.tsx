import { Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge, DIFFICULTY_BADGE } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import type { QuestEntry } from '../../services/quests.api';

interface EntryRowProps {
  entry: QuestEntry;
  onUndo?: (entry: QuestEntry) => void;
  undoing?: boolean;
}

export function EntryRow({ entry, onUndo, undoing }: EntryRowProps) {
  const time = new Date(entry.completedAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="group flex items-start gap-3 rounded-lg border border-surface-800 bg-surface-900 px-4 py-3 transition-colors hover:border-surface-700">
      {/* Time gutter */}
      <div className="w-14 shrink-0 pt-0.5">
        <span className="font-mono text-xs text-surface-500">{time}</span>
      </div>

      {/* Body */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to={`/quests/${entry.quest.id}`}
            className="font-medium text-surface-100 hover:text-primary-300 truncate"
          >
            {entry.quest.title}
          </Link>
          {entry.quest.category && (
            <Badge
              size="sm"
              style={{
                backgroundColor: `${entry.quest.category.color}20`,
                color: entry.quest.category.color,
                borderColor: `${entry.quest.category.color}40`,
                borderWidth: 1,
                borderStyle: 'solid',
              }}
            >
              {entry.quest.category.name}
            </Badge>
          )}
          <Badge size="sm" variant={DIFFICULTY_BADGE[entry.quest.difficulty]}>
            {entry.quest.difficulty}
          </Badge>
        </div>
        {entry.note && (
          <p className="mt-1 text-sm text-surface-400 whitespace-pre-wrap">{entry.note}</p>
        )}
      </div>

      {/* XP + undo */}
      <div className="flex shrink-0 items-center gap-2">
        <span className="font-mono text-sm text-xp-400">+{entry.xpEarned}</span>
        <Button
          size="icon"
          variant="ghost"
          loading={undoing}
          onClick={() => onUndo?.(entry)}
          aria-label="Undo completion"
          className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
        >
          <Trash2 className="h-3.5 w-3.5 text-danger-400" />
        </Button>
      </div>
    </div>
  );
}
