import { Card } from '../../components/ui/Card';
import { Heatmap } from '../../components/shared/Heatmap';

interface ConsistencyHeatmapProps {
  series: { date: string; count: number }[];
  loading?: boolean;
}

export function ConsistencyHeatmap({ series, loading }: ConsistencyHeatmapProps) {
  return (
    <Card>
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-lg font-semibold text-surface-50">Consistency</h2>
        <span className="text-xs text-surface-500">Last 52 weeks</span>
      </div>

      {loading ? (
        <div className="h-32 animate-pulse rounded-md bg-surface-800" />
      ) : (
        <Heatmap data={series} weeks={52} />
      )}
    </Card>
  );
}
