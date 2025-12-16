import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QuestCard } from '../features/quests/QuestCard';
import { renderWithProviders } from '../test/utils';
import type { Quest } from '../services/quests.api';

function makeStrip(lastCompleted: boolean) {
  return Array.from({ length: 14 }, (_, i) => ({
    date: `2026-04-${String(i + 18).padStart(2, '0')}`,
    completed: i === 13 ? lastCompleted : false,
  }));
}

const baseQuest: Quest = {
  id: 'quest-1',
  title: 'Slay the morning dragon',
  description: 'Wake up before 7am and meditate',
  status: 'ACTIVE',
  difficulty: 'MEDIUM',
  frequency: 'DAILY',
  xp_reward: 20,
  is_active: true,
  due_date: null,
  completed_at: null,
  category: null,
  streak: 7,
  longest_streak: 10,
  total_completions: 30,
  strip: makeStrip(false),
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

describe('QuestCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the quest title', () => {
    renderWithProviders(<QuestCard quest={baseQuest} />);
    expect(screen.getByText('Slay the morning dragon')).toBeInTheDocument();
  });

  it('renders the streak count', () => {
    renderWithProviders(<QuestCard quest={{ ...baseQuest, streak: 7 }} />);
    expect(screen.getByText('7')).toBeInTheDocument();
  });

  it('Complete button is visible and enabled when not completed today', () => {
    renderWithProviders(<QuestCard quest={baseQuest} />);
    const btn = screen.getByRole('button', { name: /complete/i });
    expect(btn).toBeInTheDocument();
    expect(btn).not.toBeDisabled();
  });

  it('calls onComplete with the quest when Complete button is clicked', async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    renderWithProviders(<QuestCard quest={baseQuest} onComplete={onComplete} />);

    await user.click(screen.getByRole('button', { name: /complete/i }));

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith(baseQuest);
  });

  it('hides Complete button and shows Unarchive button when quest is ARCHIVED', async () => {
    const user = userEvent.setup();
    const onUnarchive = vi.fn();
    const onArchive = vi.fn();
    const archivedQuest: Quest = { ...baseQuest, status: 'ARCHIVED' };

    renderWithProviders(
      <QuestCard quest={archivedQuest} onUnarchive={onUnarchive} onArchive={onArchive} />,
    );

    expect(screen.queryByRole('button', { name: /complete/i })).not.toBeInTheDocument();

    // The archived state renders an ArchiveRestore icon button (ghost, no text label).
    // It is the last button in the action row (after Edit).
    const buttons = screen.getAllByRole('button');
    // There should be only 2 buttons when archived: Edit (via Link→Button) and Unarchive (ghost)
    // But Edit is a Link wrapping a Button, so we look for the last non-Edit button.
    // The unarchive ghost button is the last button rendered.
    const unarchiveBtn = buttons[buttons.length - 1];
    expect(unarchiveBtn).toBeInTheDocument();

    await user.click(unarchiveBtn);
    expect(onUnarchive).toHaveBeenCalledTimes(1);
    expect(onUnarchive).toHaveBeenCalledWith(archivedQuest);
  });

  it('disables Complete button when completing=true', () => {
    renderWithProviders(<QuestCard quest={baseQuest} completing={true} />);
    const btn = screen.getByRole('button', { name: /complete/i });
    expect(btn).toBeDisabled();
  });
});
