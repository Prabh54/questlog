import type {
  CategoryListResponse,
  CategoryResponse,
  CreateCategoryInput,
  CreateQuestInput,
  EntryResponse,
  FeedQueryInput,
  FeedResponse,
  ListQuestsQueryInput,
  QuestDifficulty,
  QuestFrequency,
  QuestListResponse,
  QuestResponse,
  UpdateCategoryInput,
  UpdateQuestInput,
} from '@questlog/shared';
import { api } from '../lib/api';

// Wire types come from @questlog/shared — the same Zod schemas the API validates
// requests with and is contract-tested against.
export type { Category, FeedResponse, Quest, QuestEntry, QuestStatus, StripDay } from '@questlog/shared';
export type Difficulty = QuestDifficulty;
export type Frequency = QuestFrequency;
export type QuestFiltersQuery = ListQuestsQueryInput;
export type CreateQuestPayload = CreateQuestInput;
export type UpdateQuestPayload = UpdateQuestInput;
export type CreateCategoryPayload = CreateCategoryInput;
export type UpdateCategoryPayload = UpdateCategoryInput;
export type FeedQuery = FeedQueryInput;

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
    api.get<QuestListResponse>(`/quests${buildQs(filters)}`),
  getById: (id: string) => api.get<QuestResponse>(`/quests/${id}`),
  create: (payload: CreateQuestPayload) => api.post<QuestResponse>('/quests', payload),
  update: (id: string, payload: UpdateQuestPayload) =>
    api.patch<QuestResponse>(`/quests/${id}`, payload),
  remove: (id: string) => api.delete<void>(`/quests/${id}`),
  archive: (id: string) => api.post<QuestResponse>(`/quests/${id}/archive`),
  unarchive: (id: string) => api.post<QuestResponse>(`/quests/${id}/unarchive`),
  complete: (id: string, note?: string) =>
    api.post<EntryResponse>(`/quests/${id}/complete`, { note }),
};

// ── Entries (history feed) ────────────────────────────────────────────────
export const entriesApi = {
  feed: (q: FeedQuery = {}) => {
    const params = new URLSearchParams();
    Object.entries(q).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
    });
    const qs = params.toString();
    return api.get<FeedResponse>(`/entries${qs ? `?${qs}` : ''}`);
  },
  getById: (id: string) => api.get<EntryResponse>(`/entries/${id}`),
  remove: (id: string) => api.delete<void>(`/entries/${id}`),
};

// ── Categories ────────────────────────────────────────────────────────────
export const categoriesApi = {
  list: () => api.get<CategoryListResponse>('/categories'),
  create: (payload: CreateCategoryPayload) =>
    api.post<CategoryResponse>('/categories', payload),
  update: (id: string, payload: UpdateCategoryPayload) =>
    api.patch<CategoryResponse>(`/categories/${id}`, payload),
  remove: (id: string) => api.delete<void>(`/categories/${id}`),
};
