import { describe, it, expect, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import DashboardPage from '../features/dashboard/DashboardPage';
import { renderWithProviders } from '../test/utils';

// Mock chart/heatmap/progress components that depend on ResizeObserver (not available in jsdom)
vi.mock('../features/dashboard/WeeklyChart', () => ({
  WeeklyChart: () => <div data-testid="weekly-chart" />,
}));
vi.mock('../features/dashboard/ConsistencyHeatmap', () => ({
  ConsistencyHeatmap: () => <div data-testid="consistency-heatmap" />,
}));
vi.mock('../features/dashboard/TodayQuests', () => ({
  TodayQuests: () => <div data-testid="today-quests" />,
}));
// Mock XPBar to prevent duplicate "Level" text that conflicts with stat card assertions
vi.mock('../components/shared/XPBar', () => ({
  XPBar: ({ level }: { level: number }) => <div data-testid="xp-bar">xp-bar-level-{level}</div>,
}));

vi.mock('../services/analytics.api', () => ({
  analyticsApi: {
    getDashboardSummary: vi.fn().mockResolvedValue({
      totalXp: 1250,
      level: 8,
      xpInLevel: 50,
      xpToNext: 350,
      xpProgress: 0.125,
      todayCompletionPct: 75,
      activeQuestCount: 4,
      bestStreak: 12,
      todayQuests: [],
    }),
    getCompletionTimeSeries: vi.fn().mockResolvedValue({ series: [] }),
  },
}));

vi.mock('../services/quests.api', () => ({
  entriesApi: { feed: vi.fn().mockResolvedValue({ entries: [], nextCursor: null }) },
}));

vi.mock('../features/auth/useAuth', () => ({
  useAuth: () => ({
    user: { username: 'Hero', xp: 1250, level: 8, timezone: 'UTC' },
    token: 'tok',
    isLoading: false,
    login: vi.fn(),
    register: vi.fn(),
    updateMe: vi.fn(),
    logout: vi.fn(),
  }),
}));

describe('DashboardPage integration', () => {
  it('renders all 5 stat cards with correct values from the API', async () => {
    renderWithProviders(<DashboardPage />);

    // Wait for the async data to resolve — 1250 is a sufficiently unique value
    await screen.findByText('1250');

    // Now all stat cards are populated, assert within each card
    const totalXpLabel = screen.getByText('Total XP');
    const totalXpCard = totalXpLabel.closest('[class*="rounded"]')!;
    expect(within(totalXpCard as HTMLElement).getByText('1250')).toBeInTheDocument();

    const levelLabel = screen.getByText('Level');
    const levelCard = levelLabel.closest('[class*="rounded"]')!;
    expect(within(levelCard as HTMLElement).getByText('8')).toBeInTheDocument();

    const activeLabel = screen.getByText('Active quests');
    const activeCard = activeLabel.closest('[class*="rounded"]')!;
    expect(within(activeCard as HTMLElement).getByText('4')).toBeInTheDocument();

    const streakLabel = screen.getByText('Best streak');
    const streakCard = streakLabel.closest('[class*="rounded"]')!;
    expect(within(streakCard as HTMLElement).getByText('12')).toBeInTheDocument();

    // Today completion pct — 75% is unique in the DOM
    expect(screen.getByText('75%')).toBeInTheDocument();
  });

  it('shows the correct stat card labels', async () => {
    renderWithProviders(<DashboardPage />);

    expect(await screen.findByText('Total XP')).toBeInTheDocument();
    expect(screen.getByText('Level')).toBeInTheDocument();
    expect(screen.getByText('Active quests')).toBeInTheDocument();
    expect(screen.getByText('Best streak')).toBeInTheDocument();
    expect(screen.getByText('Today')).toBeInTheDocument();
  });
});
