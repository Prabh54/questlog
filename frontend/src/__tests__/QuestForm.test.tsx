import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QuestForm } from '../features/quests/QuestForm';
import { renderWithProviders } from '../test/utils';
import { questsApi } from '../services/quests.api';

vi.mock('../services/quests.api', () => ({
  categoriesApi: { list: vi.fn().mockResolvedValue({ categories: [] }) },
  questsApi: { create: vi.fn(), update: vi.fn() },
}));

describe('QuestForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(questsApi.create).mockResolvedValue({ quest: {
      id: 'new-quest',
      title: 'Test Quest',
      description: null,
      status: 'ACTIVE',
      difficulty: 'MEDIUM',
      frequency: 'DAILY',
      xp_reward: 10,
      is_active: true,
      due_date: null,
      completed_at: null,
      category: null,
      streak: 0,
      longest_streak: 0,
      total_completions: 0,
      strip: [],
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    }});
  });

  it('shows "Title is required" validation error when title is empty on submit', async () => {
    const user = userEvent.setup();
    renderWithProviders(<QuestForm onSuccess={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /create quest/i }));

    expect(await screen.findByText('Title is required')).toBeInTheDocument();
  });

  it('renders default values: difficulty=MEDIUM, frequency=DAILY, xp_reward=10', async () => {
    const { container } = renderWithProviders(<QuestForm onSuccess={vi.fn()} />);

    // The select elements are not associated with labels via htmlFor, so query by name attribute
    const difficultySelect = container.querySelector('select[name="difficulty"]') as HTMLSelectElement;
    expect(difficultySelect).not.toBeNull();
    expect(difficultySelect.value).toBe('MEDIUM');

    const frequencySelect = container.querySelector('select[name="frequency"]') as HTMLSelectElement;
    expect(frequencySelect).not.toBeNull();
    expect(frequencySelect.value).toBe('DAILY');

    // XP reward range input defaults to 10
    const xpInput = screen.getByRole('slider');
    expect((xpInput as HTMLInputElement).value).toBe('10');
  });

  it('calls questsApi.create with correct data on valid submission', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    renderWithProviders(<QuestForm onSuccess={onSuccess} />);

    await user.type(screen.getByRole('textbox', { name: /title/i }), 'My New Quest');
    await user.click(screen.getByRole('button', { name: /create quest/i }));

    await waitFor(() => {
      expect(questsApi.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'My New Quest',
          difficulty: 'MEDIUM',
          frequency: 'DAILY',
          xp_reward: 10,
          is_active: true,
        }),
      );
    });
  });
});
