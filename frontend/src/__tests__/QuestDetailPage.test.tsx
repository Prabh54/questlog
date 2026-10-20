import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import QuestDetailPage from '../pages/protected/QuestDetailPage';
import { renderWithProviders } from '../test/utils';
import { entriesApi, questsApi, type Quest, type QuestEntry } from '../services/quests.api';

vi.mock('../services/quests.api', () => ({
  questsApi: {
    getById: vi.fn(),
    complete: vi.fn(),
    update: vi.fn(),
    archive: vi.fn(),
    unarchive: vi.fn(),
  },
  entriesApi: { feed: vi.fn(), remove: vi.fn() },
}));

const baseQuest: Quest = {
  id: 'quest-1',
  title: 'Read 20 pages',
  description: 'Fiction or non-fiction',
  status: 'ACTIVE',
  difficulty: 'MEDIUM',
  frequency: 'DAILY',
  xp_reward: 25,
  is_active: true,
  due_date: null,
  completed_at: null,
  category: {
    id: 'cat-1',
    name: 'Learning',
    description: null,
    color: '#3d69b7',
    icon: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  streak: 4,
  longest_streak: 11,
  total_completions: 37,
  strip: [],
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

function makeEntry(id: string, completedAt: Date): QuestEntry {
  return {
    id,
    questId: baseQuest.id,
    userId: 'user-1',
    xpEarned: 25,
    note: null,
    completedAt: completedAt.toISOString(),
    createdAt: completedAt.toISOString(),
    quest: {
      id: baseQuest.id,
      title: baseQuest.title,
      difficulty: baseQuest.difficulty,
      frequency: baseQuest.frequency,
      category: { id: 'cat-1', name: 'Learning', color: '#3d69b7' },
    },
  };
}

const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
};

function setup(quest: Quest, entries: QuestEntry[]) {
  vi.mocked(questsApi.getById).mockResolvedValue({ quest });
  vi.mocked(entriesApi.feed).mockResolvedValue({ entries, nextCursor: null, hasMore: false });
  return renderWithProviders(
    <Routes>
      <Route path="/quests/:id" element={<QuestDetailPage />} />
    </Routes>,
    { route: `/quests/${quest.id}` },
  );
}

describe('QuestDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows quest details, streaks and recent completions', async () => {
    setup(baseQuest, [makeEntry('e1', daysAgo(1)), makeEntry('e2', daysAgo(2))]);

    expect(await screen.findByRole('heading', { name: 'Read 20 pages' })).toBeInTheDocument();
    expect(screen.getByText('Fiction or non-fiction')).toBeInTheDocument();
    expect(screen.getAllByText('Learning').length).toBeGreaterThan(0);
    expect(screen.getAllByText('MEDIUM').length).toBeGreaterThan(0);
    expect(screen.getByText('Daily')).toBeInTheDocument();
    expect(screen.getByText('active')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('11')).toBeInTheDocument();
    expect(entriesApi.feed).toHaveBeenCalledWith(expect.objectContaining({ quest_id: 'quest-1' }));
    expect(await screen.findAllByRole('button', { name: 'Undo completion' })).toHaveLength(2);
    expect(screen.getByRole('link', { name: /edit/i })).toHaveAttribute(
      'href',
      '/quests/quest-1/edit',
    );
  });

  it('completes the quest when not yet done today', async () => {
    vi.mocked(questsApi.complete).mockResolvedValue({ entry: makeEntry('e3', new Date()) });
    setup(baseQuest, [makeEntry('e1', daysAgo(1))]);

    const button = await screen.findByRole('button', { name: /^complete$/i });
    await userEvent.click(button);
    await waitFor(() => expect(questsApi.complete).toHaveBeenCalledWith('quest-1'));
  });

  it('disables Complete when already done this period', async () => {
    setup(baseQuest, [makeEntry('e1', new Date())]);

    expect(await screen.findByRole('button', { name: /done today/i })).toBeDisabled();
  });

  it('pauses an active quest and undoes an entry', async () => {
    vi.mocked(questsApi.update).mockResolvedValue({ quest: { ...baseQuest, status: 'PAUSED' } });
    vi.mocked(entriesApi.remove).mockResolvedValue(undefined);
    setup(baseQuest, [makeEntry('e1', daysAgo(1))]);

    await userEvent.click(await screen.findByRole('button', { name: /pause/i }));
    await waitFor(() =>
      expect(questsApi.update).toHaveBeenCalledWith('quest-1', { is_active: false }),
    );

    await userEvent.click(await screen.findByRole('button', { name: 'Undo completion' }));
    await waitFor(() => expect(entriesApi.remove).toHaveBeenCalledWith('e1'));
  });

  it('offers Unarchive and hides Complete for archived quests', async () => {
    setup({ ...baseQuest, status: 'ARCHIVED' }, []);
    expect(await screen.findByRole('button', { name: /unarchive/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^complete$/i })).not.toBeInTheDocument();
    expect(screen.getByText(/no completions yet/i)).toBeInTheDocument();
  });

  it('shows a not-found state when the quest fails to load', async () => {
    vi.mocked(questsApi.getById).mockRejectedValue(new Error('Quest not found'));
    vi.mocked(entriesApi.feed).mockResolvedValue({ entries: [], nextCursor: null, hasMore: false });
    renderWithProviders(
      <Routes>
        <Route path="/quests/:id" element={<QuestDetailPage />} />
      </Routes>,
      { route: '/quests/missing' },
    );
    expect(await screen.findByText('Quest not found')).toBeInTheDocument();
  });
});
