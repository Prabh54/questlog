import { useQuery } from '@tanstack/react-query';
import { Activity, Flame, Swords, Target, Zap } from 'lucide-react';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card } from '../../components/ui/Card';
import { StatCard } from '../../components/shared/StatCard';
import { XPBar } from '../../components/shared/XPBar';
import { TodayQuests } from './TodayQuests';
import { WeeklyChart } from './WeeklyChart';
import { ConsistencyHeatmap } from './ConsistencyHeatmap';
import { EntryRow } from '../history/EntryRow';
import { analyticsApi } from '../../services/analytics.api';
import { entriesApi } from '../../services/quests.api';
import { useAuth } from '../auth/useAuth';

export default function DashboardPage() {
  const { user } = useAuth();

  const summaryQuery = useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: analyticsApi.getDashboardSummary,
  });

  const completions30dQuery = useQuery({
    queryKey: ['analytics/completions', { range: '30d' }],
    queryFn: () => analyticsApi.getCompletionTimeSeries('30d'),
  });

  const completions365dQuery = useQuery({
    queryKey: ['analytics/completions', { range: '365d' }],
    queryFn: () => analyticsApi.getCompletionTimeSeries('365d'),
  });

  const recentQuery = useQuery({
    queryKey: ['entries', { limit: 5 }],
    queryFn: () => entriesApi.feed({ limit: 5 }),
  });

  const summary = summaryQuery.data;
  const series30d = completions30dQuery.data?.series ?? [];
  const series365d = completions365dQuery.data?.series ?? [];
  const recent = recentQuery.data?.entries ?? [];

  return (
    <div>
      <PageHeader
        title={`Welcome back, ${user?.username ?? 'Adventurer'}`}
        description="Here's an overview of your active quests and progress."
      />

      {/* ── Stat row ─────────────────────────────────────────────────── */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard
          label="Total XP"
          value={summary?.totalXp ?? '—'}
          icon={Zap}
          tone="xp"
          className="border-t-2 border-yellow-500/60"
          iconClassName="text-yellow-500/40"
        />
        <StatCard
          label="Level"
          value={summary?.level ?? '—'}
          subtitle={summary ? `${summary.xpToNext} XP to next` : undefined}
          icon={Activity}
          tone="primary"
          className="border-t-2 border-purple-500/60"
          iconClassName="text-purple-500/40"
        />
        <StatCard
          label="Today"
          value={summary ? `${summary.todayCompletionPct}%` : '—'}
          subtitle={summary ? 'of daily quests done' : undefined}
          icon={Target}
          tone="success"
          className="border-t-2 border-emerald-500/60"
          iconClassName="text-emerald-500/40"
        />
        <StatCard
          label="Active quests"
          value={summary?.activeQuestCount ?? '—'}
          icon={Swords}
          className="border-t-2 border-blue-500/60"
          iconClassName="text-blue-500/40"
        />
        <StatCard
          label="Best streak"
          value={summary?.bestStreak ?? '—'}
          subtitle={summary && summary.bestStreak > 0 ? 'days in a row' : undefined}
          icon={Flame}
          tone="warning"
          className="border-t-2 border-orange-500/60"
          iconClassName="text-orange-500/40"
        />
      </div>

      {/* ── Middle row: Today + Player Progress ──────────────────────── */}
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {summary ? (
          <TodayQuests quests={summary.todayQuests} />
        ) : (
          <Card className="h-64 animate-pulse" />
        )}

        <Card>
          <h2 className="mb-4 text-lg font-semibold text-surface-50">Player progress</h2>
          {summary ? (
            <XPBar
              level={summary.level}
              xpInLevel={summary.xpInLevel}
              xpToNext={summary.xpToNext}
              progress={summary.xpProgress}
            />
          ) : (
            <div className="h-20 animate-pulse rounded-md bg-surface-800" />
          )}
        </Card>
      </div>

      {/* ── Heatmap row (full width) ─────────────────────────────────── */}
      <div className="mb-6">
        <ConsistencyHeatmap series={series365d} loading={completions365dQuery.isLoading} />
      </div>

      {/* ── Bottom row: chart + recent activity ──────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {completions30dQuery.isLoading ? (
          <Card className="h-64 animate-pulse" />
        ) : (
          <WeeklyChart series={series30d} />
        )}

        <Card>
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-lg font-semibold text-surface-50">Recent activity</h2>
            <a
              href="/history"
              className="text-xs text-primary-400 hover:text-primary-300"
            >
              See all →
            </a>
          </div>
          {recentQuery.isLoading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded-lg bg-surface-800" />
              ))}
            </div>
          ) : recent.length === 0 ? (
            <p className="text-sm text-surface-500 py-4 text-center">
              No completions yet — complete a quest to start your log.
            </p>
          ) : (
            <div className="space-y-2">
              {recent.map((e) => (
                <EntryRow key={e.id} entry={e} />
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
