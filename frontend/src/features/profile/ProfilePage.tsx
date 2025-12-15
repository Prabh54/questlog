import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Flame, Trophy, Zap, Calendar, Mail, Save } from 'lucide-react';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { StatCard } from '../../components/shared/StatCard';
import { useAuth } from '../auth/useAuth';
import { useToast } from '../../components/ui/Toast';
import { analyticsApi } from '../../services/analytics.api';
import { ApiError } from '../../lib/api';

// Hand-picked common IANA zones; user can type any other.
const COMMON_TIMEZONES = [
  'UTC',
  'America/Los_Angeles',
  'America/Denver',
  'America/Chicago',
  'America/New_York',
  'America/Sao_Paulo',
  'Europe/London',
  'Europe/Berlin',
  'Europe/Paris',
  'Europe/Madrid',
  'Africa/Cairo',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Bangkok',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Asia/Singapore',
  'Australia/Sydney',
  'Pacific/Auckland',
] as const;

const profileSchema = z.object({
  display_name: z
    .string()
    .min(3, 'At least 3 characters')
    .max(30, 'At most 30 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Letters, numbers, _ and - only'),
  timezone: z.string().min(1, 'Pick a timezone'),
});
type ProfileFields = z.infer<typeof profileSchema>;

export default function ProfilePage() {
  const { user, updateMe } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const streaksQuery = useQuery({
    queryKey: ['analytics/streaks'],
    queryFn: analyticsApi.getStreakSummary,
  });
  const summaryQuery = useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: analyticsApi.getDashboardSummary,
  });

  const totalCompletions = useMemo(
    () =>
      (streaksQuery.data?.quests ?? []).reduce((sum, q) => sum + q.totalCompletions, 0),
    [streaksQuery.data],
  );
  const longestEver = streaksQuery.data?.best.longest ?? 0;
  const totalXp = summaryQuery.data?.totalXp ?? user?.xp ?? 0;
  const level = summaryQuery.data?.level ?? user?.level ?? 1;

  // ── Form ──────────────────────────────────────────────────────────────
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<ProfileFields>({
    resolver: zodResolver(profileSchema),
    values: user
      ? { display_name: user.username, timezone: user.timezone }
      : undefined,
  });

  const [showAdvancedTz, setShowAdvancedTz] = useState(false);

  const mutation = useMutation({
    mutationFn: (data: ProfileFields) => updateMe(data),
    meta: { silentError: true },
    onSuccess: (updated) => {
      reset({ display_name: updated.username, timezone: updated.timezone });
      qc.invalidateQueries({ queryKey: ['dashboard', 'summary'] });
      qc.invalidateQueries({ queryKey: ['quests'] });
      toast.success('Profile updated');
    },
    onError: (err) => {
      const message =
        err instanceof ApiError
          ? err.code === 'USERNAME_TAKEN'
            ? 'That display name is already taken'
            : err.message
          : 'Could not update profile';
      toast.error(message);
    },
  });

  if (!user) return null;
  const memberSince = new Date(user.createdAt);

  return (
    <div>
      <PageHeader title="Profile" description="Your adventurer stats and settings." />

      {/* ── Stats row ──────────────────────────────────────────────── */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total XP" value={totalXp} icon={Zap} tone="xp" />
        <StatCard label="Level" value={level} icon={Trophy} tone="primary" />
        <StatCard
          label="Completions"
          value={totalCompletions}
          subtitle="all time"
          icon={Calendar}
        />
        <StatCard
          label="Longest streak"
          value={longestEver}
          subtitle={longestEver > 0 ? 'days in a row' : undefined}
          icon={Flame}
          tone="warning"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* ── Identity card ────────────────────────────────────────── */}
        <Card className="lg:col-span-1">
          <div className="flex flex-col items-center text-center">
            <div className="h-20 w-20 rounded-full bg-primary-600/20 border-2 border-primary-600/40 flex items-center justify-center text-2xl font-bold text-primary-300">
              {user.username[0].toUpperCase()}
            </div>
            <p className="mt-3 text-lg font-semibold text-surface-50">{user.username}</p>
            <p className="flex items-center gap-1.5 mt-1 text-sm text-surface-400">
              <Mail className="h-3.5 w-3.5" />
              {user.email}
            </p>
            <Badge size="sm" variant={user.role === 'ADMIN' ? 'danger' : 'default'} className="mt-3">
              {user.role}
            </Badge>
            <p className="mt-4 text-xs text-surface-500">
              Member since{' '}
              <time dateTime={user.createdAt}>
                {memberSince.toLocaleDateString(undefined, {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </time>
            </p>
          </div>
        </Card>

        {/* ── Edit form ────────────────────────────────────────────── */}
        <Card className="lg:col-span-2">
          <h2 className="text-lg font-semibold text-surface-50 mb-4">Settings</h2>

          <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="space-y-4" noValidate>
            <Input
              label="Display name"
              hint="Letters, numbers, _ and - only"
              error={errors.display_name?.message}
              {...register('display_name')}
            />

            <Input
              label="Email"
              type="email"
              value={user.email}
              disabled
              hint="Email cannot be changed yet"
              readOnly
            />

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-surface-200">Timezone</label>
              {!showAdvancedTz ? (
                <select
                  className="form-select w-full rounded-lg border border-surface-700 bg-surface-800 text-surface-100 focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                  {...register('timezone')}
                >
                  {COMMON_TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                  {/* Preserve user's current TZ if it's outside the picker */}
                  {!COMMON_TIMEZONES.includes(user.timezone as (typeof COMMON_TIMEZONES)[number]) && (
                    <option value={user.timezone}>{user.timezone}</option>
                  )}
                </select>
              ) : (
                <Input
                  placeholder="e.g. America/Los_Angeles"
                  error={errors.timezone?.message}
                  {...register('timezone')}
                />
              )}
              <button
                type="button"
                onClick={() => setShowAdvancedTz((v) => !v)}
                className="text-xs text-primary-400 hover:text-primary-300"
              >
                {showAdvancedTz ? 'Use picker' : 'Enter a different IANA timezone'}
              </button>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                disabled={!isDirty || mutation.isPending}
                loading={isSubmitting || mutation.isPending}
              >
                <Save className="h-4 w-4" />
                Save changes
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
