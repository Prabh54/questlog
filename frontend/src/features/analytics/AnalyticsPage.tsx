import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Flame, Trophy, AlertTriangle, Zap } from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card } from '../../components/ui/Card';
import { Badge, DIFFICULTY_BADGE } from '../../components/ui/Badge';
import { CompletionTrend } from './CompletionTrend';
import { CategoryBreakdown } from './CategoryBreakdown';
import {
  analyticsApi,
  type CompletionRange,
  type PerQuestStreak,
} from '../../services/analytics.api';
import { cn } from '../../lib/cn';

const XP_RANGES: { value: CompletionRange; label: string }[] = [
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
  { value: '90d', label: '90d' },
  { value: 'all', label: 'All' },
];

export default function AnalyticsPage() {
  const streaksQuery = useQuery({
    queryKey: ['analytics/streaks'],
    queryFn: analyticsApi.getStreakSummary,
  });

  const [xpRange, setXpRange] = useState<CompletionRange>('30d');
  const xpBucket = xpRange === 'all' || xpRange === '90d' ? 'week' : 'day';
  const xpQuery = useQuery({
    queryKey: ['analytics/xp', { range: xpRange, bucket: xpBucket }],
    queryFn: () => analyticsApi.getXpTimeSeries(xpRange, xpBucket),
  });

  const allQuests = streaksQuery.data?.quests ?? [];

  // Top 5 by longest streak
  const topStreaks = useMemo(
    () =>
      [...allQuests]
        .sort((a, b) => b.longest - a.longest || b.current - a.current)
        .slice(0, 5),
    [allQuests],
  );

  // Top quest: highest current streak (tie-break by total completions)
  const topQuest = useMemo<PerQuestStreak | null>(() => {
    if (allQuests.length === 0) return null;
    return [...allQuests].sort(
      (a, b) => b.current - a.current || b.totalCompletions - a.totalCompletions,
    )[0];
  }, [allQuests]);

  // Weakest quest: prefer one with completions=0; otherwise lowest current streak
  const weakQuest = useMemo<PerQuestStreak | null>(() => {
    if (allQuests.length === 0) return null;
    return [...allQuests].sort(
      (a, b) => a.totalCompletions - b.totalCompletions || a.current - b.current,
    )[0];
  }, [allQuests]);

  const xpSeries = xpQuery.data?.series ?? [];

  return (
    <div>
      <PageHeader
        title="Analytics"
        description="Visualise your completion patterns, streaks, and XP growth."
      />

      {/* ── 1. Completions over time ─────────────────────────────────── */}
      <div className="mb-6">
        <CompletionTrend />
      </div>

      {/* ── 2. Category + Streak summary ─────────────────────────────── */}
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <CategoryBreakdown />
        <StreakTable rows={topStreaks} loading={streaksQuery.isLoading} />
      </div>

      {/* ── 3. Top vs weakest quest ──────────────────────────────────── */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <QuestHighlightCard
          tone="success"
          icon={Trophy}
          label="Top quest"
          quest={topQuest}
          metric={topQuest ? `${topQuest.current}-day streak` : undefined}
          empty="Complete a few quests to see your champion."
        />
        <QuestHighlightCard
          tone="warning"
          icon={AlertTriangle}
          label="Needs love"
          quest={weakQuest && weakQuest === topQuest ? null : weakQuest}
          metric={
            weakQuest
              ? weakQuest.totalCompletions === 0
                ? 'No completions yet'
                : `${weakQuest.current}-day streak`
              : undefined
          }
          empty="Nothing under-loved right now."
        />
      </div>

      {/* ── 4. XP over time ──────────────────────────────────────────── */}
      <Card>
        <div className="mb-4 flex items-baseline justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-surface-50">XP over time</h2>
            <p className="mt-0.5 text-xs text-surface-500">
              Cumulative XP {xpBucket === 'week' ? '(weekly buckets)' : '(daily buckets)'}
            </p>
          </div>
          <div className="flex rounded-lg bg-surface-800 p-0.5">
            {XP_RANGES.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => setXpRange(r.value)}
                className={cn(
                  'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                  xpRange === r.value
                    ? 'bg-primary-600 text-white'
                    : 'text-surface-400 hover:text-surface-200',
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {xpQuery.isLoading ? (
          <div className="h-56 animate-pulse rounded-md bg-surface-800" />
        ) : xpSeries.length === 0 ? (
          <p className="py-12 text-center text-sm text-surface-500">
            No XP yet — earn some by completing quests.
          </p>
        ) : (
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={xpSeries} margin={{ top: 5, right: 12, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="xp-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#eab308" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#eab308" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis
                  dataKey="date"
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  interval={Math.max(0, Math.floor(xpSeries.length / 6) - 1)}
                  tickFormatter={(d) =>
                    new Date(d).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                    })
                  }
                />
                <YAxis
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  labelStyle={{ color: '#cbd5e1' }}
                  labelFormatter={(label: string) =>
                    new Date(label).toLocaleDateString(undefined, {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    })
                  }
                  formatter={(value: number, name: string) => {
                    if (name === 'cumulativeXp') return [value, 'Total XP'];
                    if (name === 'level') return [value, 'Level'];
                    return [value, name];
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="cumulativeXp"
                  stroke="#eab308"
                  strokeWidth={2}
                  fill="url(#xp-fill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>
    </div>
  );
}

// ── Streak table ──────────────────────────────────────────────────────────
function StreakTable({
  rows,
  loading,
}: {
  rows: PerQuestStreak[];
  loading: boolean;
}) {
  return (
    <Card>
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-lg font-semibold text-surface-50">Top 5 streaks</h2>
        <span className="text-xs text-surface-500">By longest run</span>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded-md bg-surface-800" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-surface-500">No quests yet.</p>
      ) : (
        <ul className="divide-y divide-surface-800">
          {rows.map((r) => (
            <li key={r.questId} className="flex items-center gap-3 py-2.5">
              <Link
                to={`/quests/${r.questId}`}
                className="min-w-0 flex-1 truncate text-sm font-medium text-surface-100 hover:text-primary-300"
              >
                {r.questTitle}
              </Link>
              <Badge size="sm" variant={DIFFICULTY_BADGE[r.difficulty]}>
                {r.difficulty}
              </Badge>
              <span className="flex items-center gap-1 font-mono text-xs text-orange-400">
                <Flame className="h-3 w-3 fill-orange-400" />
                {r.longest}
              </span>
              <span className="font-mono text-xs text-surface-500 w-14 text-right">
                {r.totalCompletions} done
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// ── Highlight card ────────────────────────────────────────────────────────
function QuestHighlightCard({
  tone,
  icon: Icon,
  label,
  quest,
  metric,
  empty,
}: {
  tone: 'success' | 'warning';
  icon: typeof Trophy;
  label: string;
  quest: PerQuestStreak | null;
  metric?: string;
  empty: string;
}) {
  const toneClass =
    tone === 'success'
      ? 'border-success-500/30 bg-success-500/5 text-success-400'
      : 'border-warning-500/30 bg-warning-500/5 text-warning-400';

  return (
    <Card className={cn('border', toneClass)}>
      <div className="flex items-start gap-3">
        <div className={cn('shrink-0 rounded-lg p-2 bg-surface-900/60', toneClass)}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-surface-500">
            {label}
          </p>
          {quest ? (
            <>
              <Link
                to={`/quests/${quest.questId}`}
                className="mt-1 block truncate text-lg font-semibold text-surface-50 hover:text-primary-300"
              >
                {quest.questTitle}
              </Link>
              <div className="mt-1 flex items-center gap-2">
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
                {metric && (
                  <span className="font-mono text-xs text-surface-300">
                    <Zap className="inline h-3 w-3 text-xp-400 mr-0.5" />
                    {metric}
                  </span>
                )}
              </div>
            </>
          ) : (
            <p className="mt-1 text-sm text-surface-400">{empty}</p>
          )}
        </div>
      </div>
    </Card>
  );
}
