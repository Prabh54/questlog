import { api } from '../lib/api';

// ── Shared types ──────────────────────────────────────────────────────────
export type CompletionRange = '7d' | '30d' | '90d' | '365d' | 'all';
export type CompletionBucket = 'day' | 'week';

export interface TodayQuestSummary {
  id: string;
  title: string;
  difficulty: string;
  xp_reward: number;
  category: { id: string; name: string; color: string } | null;
  completedToday: boolean;
}

export interface DashboardSummary {
  totalXp: number;
  level: number;
  xpInLevel: number;
  xpToNext: number;
  xpProgress: number;
  todayCompletionPct: number;
  activeQuestCount: number;
  bestStreak: number;
  todayQuests: TodayQuestSummary[];
}

export interface TimeSeriesPoint {
  date: string;
  count: number;
}
export interface CompletionsResponse {
  range: CompletionRange;
  bucket: CompletionBucket;
  series: TimeSeriesPoint[];
}

export interface PerQuestStreak {
  questId: string;
  questTitle: string;
  difficulty: string;
  frequency: 'ONCE' | 'DAILY' | 'WEEKLY' | 'MONTHLY';
  category: { id: string; name: string; color: string } | null;
  current: number;
  longest: number;
  totalCompletions: number;
}
export interface StreakSummary {
  quests: PerQuestStreak[];
  best: { current: number; longest: number };
}

export interface CategoryBreakdownRow {
  categoryId: string | null;
  name: string;
  color: string;
  completions: number;
  xp: number;
  pctOfTotal: number;
}
export interface CategoryBreakdown {
  categories: CategoryBreakdownRow[];
  total: number;
}

export interface XpTimeSeriesPoint {
  date: string;
  xp: number;
  cumulativeXp: number;
  level: number;
}
export interface XpTimeSeriesResponse {
  range: CompletionRange;
  bucket: CompletionBucket;
  series: XpTimeSeriesPoint[];
}

// ── Client ────────────────────────────────────────────────────────────────
function qs(params: Record<string, string | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) sp.set(k, v);
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export const analyticsApi = {
  getDashboardSummary: () => api.get<DashboardSummary>('/dashboard/summary'),

  getCompletionTimeSeries: (
    range: CompletionRange = '30d',
    bucket: CompletionBucket = 'day',
  ) =>
    api.get<CompletionsResponse>(
      `/analytics/completions${qs({ range, bucket })}`,
    ),

  getStreakSummary: () => api.get<StreakSummary>('/analytics/streaks'),

  getCategoryBreakdown: () => api.get<CategoryBreakdown>('/analytics/categories'),

  getXpTimeSeries: (range: CompletionRange = '30d', bucket: CompletionBucket = 'day') =>
    api.get<XpTimeSeriesResponse>(`/analytics/xp${qs({ range, bucket })}`),
};
