import { useQuery } from '@tanstack/react-query';
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card } from '../../components/ui/Card';
import { analyticsApi } from '../../services/analytics.api';

export function CategoryBreakdown() {
  const { data, isLoading } = useQuery({
    queryKey: ['analytics/categories'],
    queryFn: analyticsApi.getCategoryBreakdown,
  });

  const categories = data?.categories ?? [];
  const total = data?.total ?? 0;

  return (
    <Card>
      <div className="mb-4 flex items-baseline justify-between">
        <div>
          <h2 className="text-lg font-semibold text-surface-50">Category breakdown</h2>
          <p className="mt-0.5 text-xs text-surface-500">
            <span className="font-mono text-surface-300">{total}</span> total completions
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="h-56 animate-pulse rounded-md bg-surface-800" />
      ) : categories.length === 0 ? (
        <p className="py-12 text-center text-sm text-surface-500">
          No data yet — complete quests to see how they split across categories.
        </p>
      ) : (
        <>
          <div style={{ height: Math.max(56, categories.length * 36) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={categories}
                layout="vertical"
                margin={{ top: 4, right: 36, left: 4, bottom: 4 }}
              >
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="name"
                  stroke="#94a3b8"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  width={110}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }}
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(value: number, _name, ctx) => {
                    const pct = (ctx.payload as { pctOfTotal: number }).pctOfTotal;
                    return [`${value} (${pct}%)`, 'completions'];
                  }}
                />
                <Bar dataKey="completions" radius={[0, 6, 6, 0]} label={{
                  position: 'right',
                  fill: '#cbd5e1',
                  fontSize: 11,
                  formatter: (v: number) => `${v}`,
                }}>
                  {categories.map((c) => (
                    <Cell key={c.categoryId ?? 'none'} fill={c.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Legend with percentages */}
          <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
            {categories.map((c) => (
              <div key={c.categoryId ?? 'none'} className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-sm shrink-0"
                  style={{ backgroundColor: c.color }}
                />
                <span className="text-surface-300 truncate">{c.name}</span>
                <span className="ml-auto font-mono text-surface-500">
                  {c.pctOfTotal}%
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}
