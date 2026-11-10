import type {
  Bucket,
  CategoryBreakdown,
  CompletionsResponse,
  DashboardSummary,
  Range,
  StreakSummary,
  TodayQuest,
  XpTimeSeriesResponse,
} from '@questlog/shared';
import { api } from '../lib/api';

// Wire types come from @questlog/shared — the same Zod schemas the API is tested against.
export type CompletionRange = Range;
export type CompletionBucket = Bucket;
export type TodayQuestSummary = TodayQuest;
export type {
  CategoryBreakdown,
  CategoryBreakdownRow,
  CompletionsResponse,
  DashboardSummary,
  PerQuestStreak,
  StreakSummary,
  TimeSeriesPoint,
  XpTimeSeriesPoint,
  XpTimeSeriesResponse,
} from '@questlog/shared';

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
