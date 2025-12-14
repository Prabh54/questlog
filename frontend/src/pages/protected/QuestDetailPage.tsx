import { useParams } from 'react-router-dom';
import { PageHeader } from '../../components/layout/PageHeader';

export default function QuestDetailPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <div>
      <PageHeader title="Quest detail" description={`Quest ID: ${id}`} />
      {/* TODO: quest detail, entries, edit */}
      <p className="text-surface-500 text-sm">Quest detail coming soon…</p>
    </div>
  );
}
