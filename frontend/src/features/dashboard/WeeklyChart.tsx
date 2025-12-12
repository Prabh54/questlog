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

interface WeeklyChartProps {
  series: { date: string; count: number }[];
}

const formatTick = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

export function WeeklyChart({ series }: WeeklyChartProps) {
  const total = series.reduce((sum, p) => sum + p.count, 0);
  const max = Math.max(1, ...series.map((p) => p.count));

  return (
    <Card>
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-lg font-semibold text-surface-50">Completions (last 30 days)</h2>
        <span className="font-mono text-sm text-surface-400">{total} total</span>
      </div>

      <div className="h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={series} margin={{ top: 5, right: 12, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={formatTick}
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
    </Card>
  );
}
