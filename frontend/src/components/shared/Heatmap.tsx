import { useMemo } from 'react';
import { cn } from '../../lib/cn';

export interface HeatmapDay {
  date: string; // YYYY-MM-DD
  count: number;
}

interface HeatmapProps {
  data: HeatmapDay[];
  weeks?: number;
  className?: string;
}

// Five intensity buckets — 0 / 1 / 2-3 / 4-5 / 6+
const LEVEL_CLASS = [
  'bg-surface-800',
  'bg-primary-900',
  'bg-primary-700',
  'bg-primary-500',
  'bg-primary-300',
];

function bucket(count: number): number {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  if (count <= 5) return 3;
  return 4;
}

const DAY_LABELS = ['Mon', '', 'Wed', '', 'Fri', '', ''];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Build a `weeks × 7` grid ending on the Sunday of the current ISO week.
 * Days outside the data set render as the empty bucket.
 */
function buildGrid(data: HeatmapDay[], weeks: number) {
  const byDate = new Map(data.map((d) => [d.date, d.count]));

  const today = new Date();
  // Walk forward to this week's Sunday (ISO: Mon=1..Sun=7 → JS getDay() Sun=0)
  const jsDay = today.getDay(); // 0=Sun
  const daysToSunday = jsDay === 0 ? 0 : 7 - jsDay;
  const end = new Date(today);
  end.setDate(today.getDate() + daysToSunday);

  // Start = Monday `weeks-1` weeks before the end's week
  const start = new Date(end);
  start.setDate(end.getDate() - (weeks * 7 - 1));

  const cells: { date: string; count: number; col: number; row: number; future: boolean }[] = [];
  const cursor = new Date(start);
  for (let i = 0; i < weeks * 7; i++) {
    const yyyy = cursor.getFullYear();
    const mm = String(cursor.getMonth() + 1).padStart(2, '0');
    const dd = String(cursor.getDate()).padStart(2, '0');
    const key = `${yyyy}-${mm}-${dd}`;
    cells.push({
      date: key,
      count: byDate.get(key) ?? 0,
      col: Math.floor(i / 7),
      row: i % 7, // 0 = Monday
      future: cursor > today,
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  // Month labels: position the label at the column where the 1st of the month falls
  const monthLabels: { col: number; label: string }[] = [];
  let lastMonth = -1;
  for (const c of cells) {
    const m = Number(c.date.slice(5, 7)) - 1;
    if (m !== lastMonth && c.row === 0) {
      monthLabels.push({ col: c.col, label: MONTHS[m] });
      lastMonth = m;
    }
  }

  return { cells, monthLabels };
}

export function Heatmap({ data, weeks = 52, className }: HeatmapProps) {
  const { cells, monthLabels } = useMemo(() => buildGrid(data, weeks), [data, weeks]);
  const totalCompletions = data.reduce((sum, d) => sum + d.count, 0);
  const activeDays = data.filter((d) => d.count > 0).length;

  return (
    <div className={cn('w-full', className)}>
      {/* Month labels row */}
      <div
        className="ml-8 grid gap-[3px] text-[10px] text-surface-500 mb-1"
        style={{ gridTemplateColumns: `repeat(${weeks}, 1fr)` }}
      >
        {Array.from({ length: weeks }).map((_, col) => {
          const label = monthLabels.find((m) => m.col === col)?.label ?? '';
          return (
            <span key={col} className="text-left whitespace-nowrap">
              {label}
            </span>
          );
        })}
      </div>

      <div className="flex gap-2">
        {/* Day labels column */}
        <div
          className="grid gap-[3px] text-[10px] text-surface-500"
          style={{ gridTemplateRows: 'repeat(7, 1fr)' }}
        >
          {DAY_LABELS.map((label, i) => (
            <span key={i} className="flex h-3 items-center">
              {label}
            </span>
          ))}
        </div>

        {/* Grid */}
        <div
          className="grid gap-[3px] flex-1"
          style={{
            gridTemplateColumns: `repeat(${weeks}, minmax(0, 1fr))`,
            gridTemplateRows: 'repeat(7, 1fr)',
            gridAutoFlow: 'column',
          }}
        >
          {cells.map((c) => (
            <div
              key={c.date}
              title={`${c.date}: ${c.count} ${c.count === 1 ? 'completion' : 'completions'}`}
              className={cn(
                'h-3 rounded-[2px] transition-colors',
                c.future ? 'bg-transparent' : LEVEL_CLASS[bucket(c.count)],
              )}
            />
          ))}
        </div>
      </div>

      {/* Legend + summary */}
      <div className="ml-8 mt-3 flex items-center justify-between text-xs text-surface-500">
        <span>
          <span className="font-mono text-surface-300">{totalCompletions}</span> completions across{' '}
          <span className="font-mono text-surface-300">{activeDays}</span> days
        </span>
        <div className="flex items-center gap-1.5">
          <span className="mr-1">Less</span>
          {LEVEL_CLASS.map((cls, i) => (
            <span key={i} className={cn('h-3 w-3 rounded-[2px]', cls)} />
          ))}
          <span className="ml-1">More</span>
        </div>
      </div>
    </div>
  );
}
