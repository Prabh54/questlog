import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, X } from 'lucide-react';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { cn } from '../../lib/cn';
import {
  categoriesApi,
  questsApi,
  type Quest,
  type CreateQuestPayload,
} from '../../services/quests.api';
import { ApiError } from '../../lib/api';

// ── Schema (form-level; coerces strings from <select> back to enums) ─────
const questFormSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(2000).optional(),
  category_id: z.string().optional(),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD', 'LEGENDARY']),
  frequency: z.enum(['ONCE', 'DAILY', 'WEEKLY', 'MONTHLY']),
  xp_reward: z.coerce.number().int().min(5).max(100),
  is_active: z.boolean(),
});
type FormFields = z.infer<typeof questFormSchema>;

interface QuestFormProps {
  initial?: Quest;
  onSuccess: (quest: Quest) => void;
  onCancel?: () => void;
}

export function QuestForm({ initial, onSuccess, onCancel }: QuestFormProps) {
  const qc = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const [newCategoryOpen, setNewCategoryOpen] = useState(false);

  const { data: catsData } = useQuery({
    queryKey: ['categories'],
    queryFn: categoriesApi.list,
  });
  const categories = catsData?.categories ?? [];

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormFields>({
    resolver: zodResolver(questFormSchema),
    defaultValues: {
      title: initial?.title ?? '',
      description: initial?.description ?? '',
      category_id: initial?.category?.id ?? '',
      difficulty: initial?.difficulty ?? 'MEDIUM',
      frequency: initial?.frequency ?? 'DAILY',
      xp_reward: initial?.xp_reward ?? 10,
      is_active: initial?.is_active ?? true,
    },
  });

  const xpValue = watch('xp_reward');

  const mutation = useMutation({
    mutationFn: async (data: CreateQuestPayload) =>
      initial ? questsApi.update(initial.id, data) : questsApi.create(data),
    meta: { silentError: true }, // form shows inline error
    onSuccess: ({ quest }) => {
      qc.invalidateQueries({ queryKey: ['quests'] });
      onSuccess(quest);
    },
    onError: (err) => {
      setServerError(err instanceof ApiError ? err.message : 'Failed to save quest');
    },
  });

  const onSubmit = (data: FormFields) => {
    setServerError(null);
    mutation.mutate({
      ...data,
      description: data.description?.trim() || null,
      category_id: data.category_id || null,
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      <Input
        label="Title"
        placeholder="Slay the morning dragon"
        error={errors.title?.message}
        required
        {...register('title')}
      />

      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-surface-200">Description</label>
        <textarea
          rows={3}
          placeholder="Optional context, plan, or notes…"
          className="form-textarea w-full rounded-lg border border-surface-700 bg-surface-800 text-surface-100 placeholder:text-surface-500 focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
          {...register('description')}
        />
      </div>

      {/* Category select + inline create */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-surface-200">Category</label>
        {!newCategoryOpen ? (
          <div className="flex gap-2">
            <select
              className="form-select flex-1 rounded-lg border border-surface-700 bg-surface-800 text-surface-100 focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
              {...register('category_id')}
            >
              <option value="">No category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={() => setNewCategoryOpen(true)}
            >
              <Plus className="h-4 w-4" />
              New
            </Button>
          </div>
        ) : (
          <InlineCategoryForm
            onCreated={(c) => {
              setValue('category_id', c.id, { shouldDirty: true });
              setNewCategoryOpen(false);
            }}
            onCancel={() => setNewCategoryOpen(false)}
          />
        )}
      </div>

      {/* Difficulty + Frequency */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-surface-200">Difficulty</label>
          <select
            className="form-select w-full rounded-lg border border-surface-700 bg-surface-800 text-surface-100 focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
            {...register('difficulty')}
          >
            <option value="EASY">Easy</option>
            <option value="MEDIUM">Medium</option>
            <option value="HARD">Hard</option>
            <option value="LEGENDARY">Legendary</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-surface-200">Frequency</label>
          <select
            className="form-select w-full rounded-lg border border-surface-700 bg-surface-800 text-surface-100 focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
            {...register('frequency')}
          >
            <option value="DAILY">Daily</option>
            <option value="WEEKLY">Weekly</option>
            <option value="MONTHLY">Monthly</option>
            <option value="ONCE">One-time</option>
          </select>
        </div>
      </div>

      {/* XP slider */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-surface-200">XP reward</label>
          <span className="font-mono text-sm text-xp-400">+{xpValue} XP</span>
        </div>
        <input
          type="range"
          min={5}
          max={100}
          step={5}
          className="w-full accent-primary-500"
          {...register('xp_reward')}
        />
        <div className="flex justify-between text-xs text-surface-500">
          <span>5</span>
          <span>100</span>
        </div>
      </div>

      {/* Active toggle */}
      <Controller
        control={control}
        name="is_active"
        render={({ field }) => (
          <label className="flex items-center justify-between rounded-lg border border-surface-700 bg-surface-800 px-4 py-3 cursor-pointer">
            <div>
              <p className="text-sm font-medium text-surface-100">Active</p>
              <p className="text-xs text-surface-400">Paused quests don't appear in your daily list</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={field.value}
              onClick={() => field.onChange(!field.value)}
              className={cn(
                'relative h-6 w-11 rounded-full transition-colors',
                field.value ? 'bg-primary-600' : 'bg-surface-700',
              )}
            >
              <span
                className={cn(
                  'absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform',
                  field.value ? 'translate-x-5' : 'translate-x-0.5',
                )}
              />
            </button>
          </label>
        )}
      />

      {serverError && (
        <p className="rounded-lg bg-danger-500/10 border border-danger-500/30 px-4 py-2.5 text-sm text-danger-400">
          {serverError}
        </p>
      )}

      <div className="flex justify-end gap-3 pt-2">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" loading={isSubmitting}>
          {initial ? 'Save changes' : 'Create quest'}
        </Button>
      </div>
    </form>
  );
}

// ── Inline new-category form ─────────────────────────────────────────────
function InlineCategoryForm({
  onCreated,
  onCancel,
}: {
  onCreated: (category: { id: string }) => void;
  onCancel: () => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [color, setColor] = useState('#6366f1');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => categoriesApi.create({ name: name.trim(), color }),
    onSuccess: ({ category }) => {
      qc.invalidateQueries({ queryKey: ['categories'] });
      onCreated(category);
    },
    onError: (err) =>
      setError(err instanceof ApiError ? err.message : 'Failed to create category'),
  });

  return (
    <div className="rounded-lg border border-primary-700/40 bg-primary-600/5 p-3 space-y-3 animate-fade-in">
      <div className="flex items-center gap-2">
        <input
          type="text"
          placeholder="Category name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="form-input flex-1 rounded-md border border-surface-700 bg-surface-900 text-sm text-surface-100"
        />
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="h-9 w-12 cursor-pointer rounded-md border border-surface-700 bg-surface-900"
        />
      </div>
      {error && <p className="text-xs text-danger-400">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          <X className="h-3 w-3" />
          Cancel
        </Button>
        <Button
          type="button"
          size="sm"
          loading={mutation.isPending}
          disabled={!name.trim()}
          onClick={() => mutation.mutate()}
        >
          Create
        </Button>
      </div>
    </div>
  );
}
