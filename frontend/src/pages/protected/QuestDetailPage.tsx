import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  Check,
  Flame,
  History as HistoryIcon,
  Pause,
  Pencil,
  Play,
  SearchX,
  Sparkles,
  Trophy,
} from 'lucide-react';
import { PageHeader } from '../../components/layout/PageHeader';
import { Badge, DIFFICULTY_BADGE, STATUS_BADGE } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { StatCard } from '../../components/shared/StatCard';
import { Heatmap, type HeatmapDay } from '../../components/shared/Heatmap';
import { EntryRow } from '../../features/history/EntryRow';
import { categoryBadgeStyle } from '../../lib/categoryStyle';
import {
  entriesApi,
  questsApi,
  type Frequency,
  type Quest,
  type QuestEntry,
} from '../../services/quests.api';

const HEATMAP_WEEKS = 26;
const RECENT_LIMIT = 10;

const FREQUENCY_LABEL: Record<Frequency, string> = {
  ONCE: 'One-time',
  DAILY: 'Daily',
  WEEKLY: 'Weekly',
  MONTHLY: 'Monthly',
};

const PERIOD_LABEL: Record<Frequency, string> = {
  ONCE: 'Done',
  DAILY: 'Done today',
  WEEKLY: 'Done this week',
  MONTHLY: 'Done this month',
};

function localDateKey(d: Date): string {
  return d.toLocaleDateString('en-CA');
}

/** Monday 00:00 local of the week containing `d`. */
function startOfWeek(d: Date): Date {
  const s = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  s.setDate(s.getDate() - ((s.getDay() + 6) % 7));
  return s;
}

/**
 * Whether the quest already has an entry in its current period. The backend
 * enforces this (409) in the user's timezone; this mirrors it in local time so
 * the button state is right without a round trip.
 */
function isDoneThisPeriod(quest: Quest, entries: QuestEntry[], now = new Date()): boolean {
  if (quest.frequency === 'ONCE') {
    return quest.status === 'COMPLETED' || quest.total_completions > 0;
  }
  const start =
    quest.frequency === 'DAILY'
      ? new Date(now.getFullYear(), now.getMonth(), now.getDate())
      : quest.frequency === 'WEEKLY'
        ? startOfWeek(now)
        : new Date(now.getFullYear(), now.getMonth(), 1);
  return entries.some((e) => new Date(e.completedAt) >= start);
}

/** Every entry for the quest since `from`, following the feed cursor. */
async function fetchQuestEntries(questId: string, from: string): Promise<QuestEntry[]> {
  const all: QuestEntry[] = [];
  let cursor: string | undefined;
  do {
    const page = await entriesApi.feed({ quest_id: questId, from, cursor, limit: 100 });
    all.push(...page.entries);
    cursor = page.hasMore ? (page.nextCursor ?? undefined) : undefined;
  } while (cursor);
  return all;
}

export default function QuestDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const qc = useQueryClient();

  // Monday that starts the heatmap's first column
  const heatmapFrom = useMemo(() => {
    const d = startOfWeek(new Date());
    d.setDate(d.getDate() - (HEATMAP_WEEKS - 1) * 7);
    return d.toISOString();
  }, []);

  const questQuery = useQuery({
    queryKey: ['quests', 'detail', id],
    queryFn: () => questsApi.getById(id),
    enabled: Boolean(id),
  });

  const entriesQuery = useQuery({
    queryKey: ['entries', 'quest', id, heatmapFrom],
    queryFn: () => fetchQuestEntries(id, heatmapFrom),
    enabled: Boolean(id),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['quests'] });
    qc.invalidateQueries({ queryKey: ['entries'] });
    qc.invalidateQueries({ queryKey: ['dashboard', 'summary'] });
  };

  const completeMutation = useMutation({
    mutationFn: () => questsApi.complete(id),
    onSuccess: invalidate,
  });
  const pauseMutation = useMutation({
    mutationFn: (active: boolean) => questsApi.update(id, { is_active: active }),
    onSuccess: invalidate,
  });
  const archiveMutation = useMutation({
    mutationFn: (archive: boolean) => (archive ? questsApi.archive(id) : questsApi.unarchive(id)),
    onSuccess: invalidate,
  });
  const undoMutation = useMutation({
    mutationFn: (entry: QuestEntry) => entriesApi.remove(entry.id),
    onSuccess: invalidate,
  });

  const entries = useMemo(() => entriesQuery.data ?? [], [entriesQuery.data]);

  const heatmapData = useMemo<HeatmapDay[]>(() => {
    const counts = new Map<string, number>();
    for (const e of entries) {
      const key = localDateKey(new Date(e.completedAt));
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts].map(([date, count]) => ({ date, count }));
  }, [entries]);

  if (questQuery.isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-16 w-1/2 animate-pulse rounded-lg bg-surface-800" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Card key={i} className="h-24 animate-pulse" />
          ))}
        </div>
        <Card className="h-48 animate-pulse" />
      </div>
    );
  }

  const quest = questQuery.data?.quest;
  if (!quest) {
    return (
      <Card className="flex flex-col items-center justify-center py-16 text-center">
        <SearchX className="mb-3 h-10 w-10 text-surface-600" />
        <p className="font-medium text-surface-200">Quest not found</p>
        <p className="mt-1 text-sm text-surface-500">
          It may have been deleted, or the link is wrong.
        </p>
        <Link to="/quests" className="mt-4">
          <Button size="sm" variant="secondary">
            <ArrowLeft className="h-4 w-4" />
            Back to quests
          </Button>
        </Link>
      </Card>
    );
  }

  const isArchived = quest.status === 'ARCHIVED';
  const canPause = quest.status === 'ACTIVE' || quest.status === 'PAUSED';
  const done = isDoneThisPeriod(quest, entries);
  const canComplete = !isArchived && quest.status !== 'COMPLETED';
  const recent = entries.slice(0, RECENT_LIMIT);
  const actionError =
    completeMutation.error ?? pauseMutation.error ?? archiveMutation.error ?? undoMutation.error;

  return (
    <div>
      <Link
        to="/quests"
        className="mb-4 inline-flex items-center gap-1 text-sm text-surface-500 hover:text-surface-200"
      >
        <ArrowLeft className="h-4 w-4" />
        Quests
      </Link>

      <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <PageHeader
          title={quest.title}
          description={quest.description ?? undefined}
          className="mb-0"
        />
        <div className="flex flex-wrap items-center gap-2 lg:shrink-0 lg:justify-end">
          {canComplete && (
            <Button
              size="sm"
              variant={done ? 'secondary' : 'primary'}
              disabled={done}
              loading={completeMutation.isPending}
              onClick={() => completeMutation.mutate()}
            >
              <Check className="h-4 w-4" />
              {done ? PERIOD_LABEL[quest.frequency] : 'Complete'}
            </Button>
          )}
          <Link to={`/quests/${quest.id}/edit`}>
            <Button size="sm" variant="secondary">
              <Pencil className="h-4 w-4" />
              Edit
            </Button>
          </Link>
          {canPause && (
            <Button
              size="sm"
              variant="secondary"
              loading={pauseMutation.isPending}
              onClick={() => pauseMutation.mutate(quest.status === 'PAUSED')}
            >
              {quest.status === 'PAUSED' ? (
                <>
                  <Play className="h-4 w-4" />
                  Resume
                </>
              ) : (
                <>
                  <Pause className="h-4 w-4" />
                  Pause
                </>
              )}
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            loading={archiveMutation.isPending}
            onClick={() => archiveMutation.mutate(!isArchived)}
          >
            {isArchived ? (
              <>
                <ArchiveRestore className="h-4 w-4" />
                Unarchive
              </>
            ) : (
              <>
                <Archive className="h-4 w-4" />
                Archive
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Meta tags */}
      <div className="mb-6 flex flex-wrap items-center gap-1.5">
        <Badge variant={STATUS_BADGE[quest.status]}>{quest.status.toLowerCase()}</Badge>
        {quest.category && (
          <Badge
            style={{
              ...categoryBadgeStyle(quest.category.color),
              borderWidth: 1,
              borderStyle: 'solid',
            }}
          >
            {quest.category.name}
          </Badge>
        )}
        <Badge variant={DIFFICULTY_BADGE[quest.difficulty]}>{quest.difficulty}</Badge>
        <Badge variant="default">{FREQUENCY_LABEL[quest.frequency]}</Badge>
        <Badge variant="xp">+{quest.xp_reward} XP</Badge>
      </div>

      {actionError && (
        <p role="alert" className="mb-4 text-sm text-danger-400">
          {actionError.message}
        </p>
      )}

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard
          label="Current streak"
          value={quest.streak}
          icon={Flame}
          iconClassName="text-flame"
        />
        <StatCard label="Best streak" value={quest.longest_streak} icon={Trophy} tone="warning" />
        <StatCard
          label="Total"
          subtitle="completions"
          value={quest.total_completions}
          icon={HistoryIcon}
          tone="primary"
        />
        <StatCard label="XP reward" value={quest.xp_reward} icon={Sparkles} tone="xp" />
      </div>

      {/* Heatmap */}
      <Card className="mb-6">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-surface-50">Consistency</h2>
          <span className="text-xs text-surface-500">Last {HEATMAP_WEEKS} weeks</span>
        </div>
        {entriesQuery.isLoading ? (
          <div className="h-32 animate-pulse rounded-md bg-surface-800" />
        ) : (
          <Heatmap data={heatmapData} weeks={HEATMAP_WEEKS} />
        )}
      </Card>

      {/* Recent completions */}
      <Card>
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-surface-50">Recent completions</h2>
          <Link to="/history" className="text-xs text-primary-600 hover:text-primary-700">
            Full history
          </Link>
        </div>
        {entriesQuery.isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-surface-800" />
            ))}
          </div>
        ) : recent.length === 0 ? (
          <p className="py-6 text-center text-sm text-surface-500">
            No completions yet. Log one to start a streak.
          </p>
        ) : (
          <div className="space-y-2">
            {recent.map((e) => (
              <div key={e.id}>
                <p className="mb-1 font-mono text-[11px] text-surface-500">
                  {new Date(e.completedAt).toLocaleDateString([], {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  })}
                </p>
                <EntryRow
                  entry={e}
                  onUndo={(entry) => undoMutation.mutate(entry)}
                  undoing={undoMutation.isPending && undoMutation.variables?.id === e.id}
                />
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
