import { api } from '../lib/api';

// ── Types ─────────────────────────────────────────────────────────────────
export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD' | 'LEGENDARY';
export type Frequency = 'ONCE' | 'DAILY' | 'WEEKLY' | 'MONTHLY';
export type QuestStatus = 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ARCHIVED';
export type EntryDayStatus = 'COMPLETED' | 'FAILED' | 'SKIPPED' | 'NONE';
export interface StripDay {
  date: string;
  completed: boolean;
}

export interface Category {
  id: string;
  name: string;
  description: string | null;
  color: string;
  icon: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { quests: number };
}

export interface Quest {
  id: string;
  title: string;
  description: string | null;
  status: QuestStatus;
  difficulty: Difficulty;
  frequency: Frequency;
  xp_reward: number;
  is_active: boolean;
  due_date: string | null;
  completed_at: string | null;
  category: Category | null;
  streak: number;
  longest_streak: number;
  total_completions: number;
  strip: StripDay[];
  created_at: string;
  updated_at: string;
}

export interface QuestEntry {
  id: string;
  questId: string;
  userId: string;
  xpEarned: number;
  note: string | null;
  completedAt: string;
  createdAt: string;
  quest: {
    id: string;
    title: string;
    difficulty: Difficulty;
    frequency: Frequency;
    category: { id: string; name: string; color: string } | null;
  };
}

export interface QuestFiltersQuery {
  search?: string;
  category_id?: string;
  difficulty?: Difficulty;
  frequency?: Frequency;
  status?: QuestStatus;
  sort?: 'newest' | 'oldest' | 'xp_desc' | 'xp_asc' | 'title';
}

export interface CreateQuestPayload {
  title: string;
  description?: string | null;
  difficulty: Difficulty;
  frequency: Frequency;
  xp_reward: number;
  category_id?: string | null;
  is_active: boolean;
}
export type UpdateQuestPayload = Partial<CreateQuestPayload>;

export interface CreateCategoryPayload {
  name: string;
  description?: string | null;
  color: string;
  icon?: string | null;
}
export type UpdateCategoryPayload = Partial<CreateCategoryPayload>;

// ── Quests ────────────────────────────────────────────────────────────────
function buildQs(q: QuestFiltersQuery): string {
  const params = new URLSearchParams();
  Object.entries(q).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
  });
  const s = params.toString();
  return s ? `?${s}` : '';
}

export const questsApi = {
  list: (filters: QuestFiltersQuery = {}) =>
    api.get<{ quests: Quest[] }>(`/quests${buildQs(filters)}`),
  getById: (id: string) => api.get<{ quest: Quest }>(`/quests/${id}`),
  create: (payload: CreateQuestPayload) => api.post<{ quest: Quest }>('/quests', payload),
  update: (id: string, payload: UpdateQuestPayload) =>
    api.patch<{ quest: Quest }>(`/quests/${id}`, payload),
  remove: (id: string) => api.delete<void>(`/quests/${id}`),
  archive: (id: string) => api.post<{ quest: Quest }>(`/quests/${id}/archive`),
  unarchive: (id: string) => api.post<{ quest: Quest }>(`/quests/${id}/unarchive`),
  complete: (id: string, note?: string) =>
    api.post<{ entry: QuestEntry }>(`/quests/${id}/complete`, { note }),
};

// ── Entries (history feed) ────────────────────────────────────────────────
export interface FeedQuery {
  cursor?: string;
  limit?: number;
  quest_id?: string;
  from?: string;
  to?: string;
}

export interface FeedResponse {
  entries: QuestEntry[];
  nextCursor: string | null;
  hasMore: boolean;
}

export const entriesApi = {
  feed: (q: FeedQuery = {}) => {
    const params = new URLSearchParams();
    Object.entries(q).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
    });
    const qs = params.toString();
    return api.get<FeedResponse>(`/entries${qs ? `?${qs}` : ''}`);
  },
  getById: (id: string) => api.get<{ entry: QuestEntry }>(`/entries/${id}`),
  remove: (id: string) => api.delete<void>(`/entries/${id}`),
};

// ── Categories ────────────────────────────────────────────────────────────
export const categoriesApi = {
  list: () => api.get<{ categories: Category[] }>('/categories'),
  create: (payload: CreateCategoryPayload) =>
    api.post<{ category: Category }>('/categories', payload),
  update: (id: string, payload: UpdateCategoryPayload) =>
    api.patch<{ category: Category }>(`/categories/${id}`, payload),
  remove: (id: string) => api.delete<void>(`/categories/${id}`),
};
