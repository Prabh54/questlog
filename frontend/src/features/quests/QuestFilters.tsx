import { Search } from 'lucide-react';
import { cn } from '../../lib/cn';
import { Input } from '../../components/ui/Input';
import type {
  Category,
  Difficulty,
  QuestFiltersQuery,
  QuestStatus,
} from '../../services/quests.api';

const DIFFICULTIES: Difficulty[] = ['EASY', 'MEDIUM', 'HARD', 'LEGENDARY'];
const STATUSES: QuestStatus[] = ['ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED'];
const SORTS = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'xp_desc', label: 'XP (high → low)' },
  { value: 'xp_asc', label: 'XP (low → high)' },
  { value: 'title', label: 'Title (A–Z)' },
] as const;

interface QuestFiltersProps {
  filters: QuestFiltersQuery;
  onChange: (filters: QuestFiltersQuery) => void;
  categories: Category[];
}

function Chip({
  active,
  onClick,
  children,
  color,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  color?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
        active
          ? 'bg-primary-600/20 border-primary-500 text-primary-200'
          : 'bg-surface-900 border-surface-700 text-surface-400 hover:border-surface-600 hover:text-surface-200',
      )}
      style={
        active && color
          ? { backgroundColor: `${color}25`, borderColor: color, color }
          : undefined
      }
    >
      {children}
    </button>
  );
}

export function QuestFilters({ filters, onChange, categories }: QuestFiltersProps) {
  const set = <K extends keyof QuestFiltersQuery>(key: K, value: QuestFiltersQuery[K]) => {
    const next = { ...filters };
    if (value === undefined || value === '') delete next[key];
    else next[key] = value;
    onChange(next);
  };

  return (
    <div className="space-y-4 mb-6">
      {/* Search + Sort */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex-1">
          <Input
            type="search"
            placeholder="Search quests…"
            prefix={<Search className="h-4 w-4" />}
            value={filters.search ?? ''}
            onChange={(e) => set('search', e.target.value || undefined)}
          />
        </div>
        <select
          className="form-select rounded-lg border border-surface-700 bg-surface-800 text-sm text-surface-100 focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
          value={filters.sort ?? 'newest'}
          onChange={(e) => set('sort', e.target.value as QuestFiltersQuery['sort'])}
        >
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {/* Categories */}
      {categories.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-wide text-surface-500 mr-1">Category</span>
          <Chip
            active={!filters.category_id}
            onClick={() => set('category_id', undefined)}
          >
            All
          </Chip>
          {categories.map((c) => (
            <Chip
              key={c.id}
              active={filters.category_id === c.id}
              color={c.color}
              onClick={() =>
                set('category_id', filters.category_id === c.id ? undefined : c.id)
              }
            >
              {c.name}
            </Chip>
          ))}
        </div>
      )}

      {/* Difficulty */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs uppercase tracking-wide text-surface-500 mr-1">Difficulty</span>
        {DIFFICULTIES.map((d) => (
          <Chip
            key={d}
            active={filters.difficulty === d}
            onClick={() => set('difficulty', filters.difficulty === d ? undefined : d)}
          >
            {d}
          </Chip>
        ))}
      </div>

      {/* Status */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs uppercase tracking-wide text-surface-500 mr-1">Status</span>
        {STATUSES.map((s) => (
          <Chip
            key={s}
            active={filters.status === s}
            onClick={() => set('status', filters.status === s ? undefined : s)}
          >
            {s}
          </Chip>
        ))}
      </div>
    </div>
  );
}
