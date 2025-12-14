import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card } from '../../components/ui/Card';
import { QuestForm } from '../../features/quests/QuestForm';
import { questsApi } from '../../services/quests.api';

export default function QuestFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const { data, isLoading } = useQuery({
    queryKey: ['quest', id],
    queryFn: () => questsApi.getById(id!),
    enabled: isEdit,
  });

  if (isEdit && isLoading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-surface-700 border-t-primary-500" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <PageHeader
        title={isEdit ? 'Edit quest' : 'New quest'}
        description={
          isEdit
            ? 'Update the details of your quest.'
            : 'Define a new quest to track your progress.'
        }
      />
      <Card>
        <QuestForm
          initial={data?.quest}
          onSuccess={(quest) => navigate(`/quests/${quest.id}`)}
          onCancel={() => navigate('/quests')}
        />
      </Card>
    </div>
  );
}
