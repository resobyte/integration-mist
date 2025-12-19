import { QuestionsTable } from './QuestionsTable';
import { ProtectedPage } from '@/components/auth/ProtectedPage';
import { Role } from '@/types';

export default function QuestionsPage() {
  return (
    <ProtectedPage currentPath="/questions" allowedRoles={[Role.PLATFORM_OWNER, Role.OPERATION]}>
      <QuestionsTable />
    </ProtectedPage>
  );
}

