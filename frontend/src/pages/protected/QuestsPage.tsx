import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Swords, SearchX } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { QuestCard } from '../../features/quests/QuestCard';
import { QuestFilters } from '../../features/quests/QuestFilters';
import {
  categoriesApi,
  questsApi,
  type QuestFiltersQuery,
  type Quest,
} from '../../services/quests.api';

function hasActiveFilters(f: QuestFiltersQuery): boolean {
  return Boolean(f.search || f.category_id || f.difficulty || f.frequency || f.status);
}

export default function QuestsPage() {
  const qc = useQueryClient();
  const [filters, setFilters] = useState<QuestFiltersQuery>({ sort: 'newest' });

  const questsQuery = useQuery({
    queryKey: ['quests', filters],
    queryFn: () => questsApi.list(filters),
  });

  const categoriesQuery = useQuery({
    queryKey: ['categories'],
    queryFn: categoriesApi.list,
  });

  const archiveMutation = useMutation({
    mutationFn: (q: Quest) => questsApi.archive(q.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quests'] }),
  });
  const unarchiveMutation = useMutation({
    mutationFn: (q: Quest) => questsApi.unarchive(q.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quests'] }),
  });
  const completeMutation = useMutation({
    mutationFn: (q: Quest) => questsApi.complete(q.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quests'] });
      qc.invalidateQueries({ queryKey: ['entries'] });
      qc.invalidateQueries({ queryKey: ['dashboard', 'summary'] });
    },
  });

  const quests = questsQuery.data?.quests ?? [];
  const categories = categoriesQuery.data?.categories ?? [];

  return (
    <div>
      <PageHeader
        title="Quests"
        description="Manage your active and upcoming quests."
        action={
          <Link to="/quests/new">
            <Button size="sm">
              <Plus className="h-4 w-4" />
              New quest
            </Button>
          </Link>
        }
      />

      <QuestFilters filters={filters} onChange={setFilters} categories={categories} />

      {questsQuery.isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Card key={i} className="h-56 animate-pulse" />
          ))}
        </div>
      ) : quests.length === 0 ? (
        hasActiveFilters(filters) ? (
          <Card className="flex flex-col items-center justify-center py-16 text-center">
            <SearchX className="mb-3 h-10 w-10 text-surface-600" />
            <p className="text-surface-200 font-medium">No quests match these filters</p>
            <p className="mt-1 text-sm text-surface-500">Try clearing a filter or two.</p>
            <Button
              size="sm"
              variant="secondary"
              className="mt-4"
              onClick={() => setFilters({ sort: 'newest' })}
            >
              Clear filters
            </Button>
          </Card>
        ) : (
          <Card className="flex flex-col items-center justify-center py-16 text-center">
            <Swords className="mb-3 h-10 w-10 text-surface-600" />
            <p className="text-surface-200 font-medium">No quests yet</p>
            <p className="mt-1 text-sm text-surface-500">
              Create your first quest to begin your journey.
            </p>
            <Link to="/quests/new" className="mt-4">
              <Button size="sm">
                <Plus className="h-4 w-4" />
                New quest
              </Button>
            </Link>
          </Card>
        )
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {quests.map((q) => (
            <QuestCard
              key={q.id}
              quest={q}
              onComplete={(q) => completeMutation.mutate(q)}
              onArchive={(q) => archiveMutation.mutate(q)}
              onUnarchive={(q) => unarchiveMutation.mutate(q)}
              completing={completeMutation.isPending && completeMutation.variables?.id === q.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
