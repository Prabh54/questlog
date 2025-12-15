import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card } from '../../components/ui/Card';
import { cn } from '../../lib/cn';
import { analyticsApi, type CompletionRange } from '../../services/analytics.api';

const RANGES: { value: CompletionRange; label: string }[] = [
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
  { value: '90d', label: '90d' },
  { value: 'all', label: 'All' },
];

function tickFormatter(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function CompletionTrend() {
  const [range, setRange] = useState<CompletionRange>('30d');
  // Auto-switch to weekly buckets on longer ranges
  const bucket = range === 'all' || range === '90d' ? 'week' : 'day';

  const { data, isLoading } = useQuery({
    queryKey: ['analytics/completions', { range, bucket }],
    queryFn: () => analyticsApi.getCompletionTimeSeries(range, bucket),
  });

  const series = data?.series ?? [];
  const total = series.reduce((sum, p) => sum + p.count, 0);
  const max = Math.max(1, ...series.map((p) => p.count));

  return (
    <Card>
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-surface-50">Completions over time</h2>
          <p className="mt-0.5 text-xs text-surface-500">
            {bucket === 'week' ? 'Weekly buckets' : 'Daily buckets'}
            {' · '}
            <span className="font-mono text-surface-300">{total}</span> total
          </p>
        </div>

        <div className="flex rounded-lg bg-surface-800 p-0.5">
          {RANGES.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => setRange(r.value)}
              className={cn(
                'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                range === r.value
                  ? 'bg-primary-600 text-white'
                  : 'text-surface-400 hover:text-surface-200',
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="h-56 animate-pulse rounded-md bg-surface-800" />
      ) : series.length === 0 ? (
        <p className="py-12 text-center text-sm text-surface-500">
          No completions in this range yet.
        </p>
      ) : (
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series} margin={{ top: 5, right: 12, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={tickFormatter}
                stroke="#64748b"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                interval={Math.max(0, Math.floor(series.length / 6) - 1)}
              />
              <YAxis
                stroke="#64748b"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
                domain={[0, Math.max(2, max)]}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelStyle={{ color: '#cbd5e1' }}
                labelFormatter={(label: string) =>
                  new Date(label).toLocaleDateString(undefined, {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  })
                }
                formatter={(value: number) => [value, 'completions']}
              />
              <Line
                type="monotone"
                dataKey="count"
                stroke="#8b5cf6"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: '#a78bfa' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
