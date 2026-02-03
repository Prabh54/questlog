import { useEffect, useMemo, useRef, useState } from 'react';
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { History as HistoryIcon } from 'lucide-react';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { EntryRow } from './EntryRow';
import { entriesApi, questsApi, type QuestEntry } from '../../services/quests.api';

interface Filters {
  questId?: string;
  from?: string;
  to?: string;
}

export default function HistoryPage() {
  const qc = useQueryClient();
  const [filters, setFilters] = useState<Filters>({});
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Quests for the filter dropdown
  const questsQuery = useQuery({
    queryKey: ['quests', { sort: 'newest' }],
    queryFn: () => questsApi.list({ sort: 'newest' }),
  });

  const feedQuery = useInfiniteQuery({
    queryKey: ['entries', filters],
    queryFn: ({ pageParam }) =>
      entriesApi.feed({
        cursor: pageParam as string | undefined,
        limit: 20,
        quest_id: filters.questId,
        from: filters.from,
        to: filters.to,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const undoMutation = useMutation({
    mutationFn: (entry: QuestEntry) => entriesApi.remove(entry.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['entries'] });
      qc.invalidateQueries({ queryKey: ['quests'] });
      qc.invalidateQueries({ queryKey: ['dashboard', 'summary'] });
    },
  });

  // Infinite-scroll trigger
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (
          entries[0]?.isIntersecting &&
          feedQuery.hasNextPage &&
          !feedQuery.isFetchingNextPage
        ) {
          feedQuery.fetchNextPage();
        }
      },
      { rootMargin: '200px' },
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, [feedQuery]);

  // Flatten pages and group by local YYYY-MM-DD
  const grouped = useMemo(() => {
    const all = feedQuery.data?.pages.flatMap((p) => p.entries) ?? [];
    const groups = new Map<string, QuestEntry[]>();
    for (const e of all) {
      const key = new Date(e.completedAt).toLocaleDateString('en-CA');
      const list = groups.get(key) ?? [];
      list.push(e);
      groups.set(key, list);
    }
    return [...groups.entries()];
  }, [feedQuery.data]);

  const totalLoaded = grouped.reduce((n, [, v]) => n + v.length, 0);
  const quests = questsQuery.data?.quests ?? [];

  return (
    <div>
      <PageHeader title="History" description="Every completion you've logged." />

      {/* Filters */}
      <Card padding="sm" className="mb-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="block text-xs uppercase tracking-wide text-surface-500 mb-1">
              Quest
            </label>
            <select
              className="form-select w-full rounded-lg border border-surface-700 bg-surface-800 text-sm text-surface-100 focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
              value={filters.questId ?? ''}
              onChange={(e) =>
                setFilters((f) => ({ ...f, questId: e.target.value || undefined }))
              }
            >
              <option value="">All quests</option>
              {quests.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.title}
                </option>
              ))}
            </select>
          </div>
          <Input
            label="From"
            type="date"
            value={filters.from ?? ''}
            onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value || undefined }))}
          />
          <Input
            label="To"
            type="date"
            value={filters.to ?? ''}
            onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value || undefined }))}
          />
        </div>
      </Card>

      {/* Feed */}
      {feedQuery.isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-surface-900" />
          ))}
        </div>
      ) : totalLoaded === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16 text-center">
          <HistoryIcon className="mb-3 h-10 w-10 text-surface-600" />
          <p className="text-surface-200 font-medium">Nothing here yet</p>
          <p className="mt-1 text-sm text-surface-500">
            Complete a quest from your dashboard to see it logged here.
          </p>
        </Card>
      ) : (
        <div className="space-y-8">
          {grouped.map(([day, entries]) => (
            <section key={day}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-surface-500">
                {new Date(day).toLocaleDateString(undefined, {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                })}
              </h3>
              <div className="space-y-2">
                {entries.map((e) => (
                  <EntryRow
                    key={e.id}
                    entry={e}
                    onUndo={(entry) => undoMutation.mutate(entry)}
                    undoing={
                      undoMutation.isPending && undoMutation.variables?.id === e.id
                    }
                  />
                ))}
              </div>
            </section>
          ))}

          {/* Sentinel triggers next page */}
          <div ref={sentinelRef} className="h-8" />

          {feedQuery.isFetchingNextPage && (
            <div className="flex justify-center py-4">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-surface-700 border-t-primary-500" />
            </div>
          )}
          {!feedQuery.hasNextPage && (
            <p className="text-center text-xs text-surface-600 py-4">
              That&apos;s everything.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
