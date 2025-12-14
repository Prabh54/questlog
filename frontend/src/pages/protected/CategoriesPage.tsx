import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { Plus } from 'lucide-react';

export default function CategoriesPage() {
  return (
    <div>
      <PageHeader
        title="Categories"
        description="Organise your quests into categories."
        action={
          <Button size="sm">
            <Plus className="h-4 w-4" />
            New category
          </Button>
        }
      />
      {/* TODO: category grid */}
      <p className="text-surface-500 text-sm">Categories coming soon…</p>
    </div>
  );
}
