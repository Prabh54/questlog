import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, CheckCircle2, Swords } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge, DIFFICULTY_BADGE } from '../../components/ui/Badge';
import { questsApi } from '../../services/quests.api';
import type { TodayQuestSummary } from '../../services/analytics.api';
import { cn } from '../../lib/cn';

interface TodayQuestsProps {
  quests: TodayQuestSummary[];
}

export function TodayQuests({ quests }: TodayQuestsProps) {
  const qc = useQueryClient();
  const completeMutation = useMutation({
    mutationFn: (id: string) => questsApi.complete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dashboard', 'summary'] });
      qc.invalidateQueries({ queryKey: ['quests'] });
      qc.invalidateQueries({ queryKey: ['entries'] });
      qc.invalidateQueries({ queryKey: ['analytics/completions'] });
    },
  });

  return (
    <Card>
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-lg font-semibold text-surface-50">Today's quests</h2>
        <Link to="/quests" className="text-xs text-primary-400 hover:text-primary-300">
          See all →
        </Link>
      </div>

      {quests.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Swords className="mb-2 h-8 w-8 text-surface-600" />
          <p className="text-sm text-surface-400">No daily quests yet.</p>
          <Link to="/quests/new" className="mt-2 text-xs text-primary-400 hover:text-primary-300">
            Create your first
          </Link>
        </div>
      ) : (
        <ul className="space-y-2">
          {quests.map((q) => (
            <li
              key={q.id}
              className={cn(
                'flex items-center gap-3 rounded-lg border border-surface-800 bg-surface-900 px-3 py-2.5 transition-opacity',
                q.completedToday && 'opacity-60',
              )}
            >
              <div className="min-w-0 flex-1">
                <Link
                  to={`/quests/${q.id}`}
                  className="block font-medium text-surface-100 hover:text-primary-300 truncate"
                >
                  {q.title}
                </Link>
                <div className="mt-1 flex items-center gap-1.5">
                  {q.category && (
                    <Badge
                      size="sm"
                      style={{
                        backgroundColor: `${q.category.color}20`,
                        color: q.category.color,
                        borderColor: `${q.category.color}40`,
                        borderWidth: 1,
                        borderStyle: 'solid',
                      }}
                    >
                      {q.category.name}
                    </Badge>
                  )}
                  <Badge size="sm" variant={DIFFICULTY_BADGE[q.difficulty]}>
                    {q.difficulty}
                  </Badge>
                  <span className="font-mono text-xs text-xp-400">+{q.xp_reward}</span>
                </div>
              </div>

              {q.completedToday ? (
                <CheckCircle2 className="h-6 w-6 text-success-500 shrink-0" />
              ) : (
                <Button
                  size="sm"
                  loading={
                    completeMutation.isPending && completeMutation.variables === q.id
                  }
                  onClick={() => completeMutation.mutate(q.id)}
                >
                  <Check className="h-3.5 w-3.5" />
                  Complete
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
