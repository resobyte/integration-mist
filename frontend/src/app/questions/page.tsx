import { getServerUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { Role } from '@/types';
import { AppLayout } from '@/components/layouts/AppLayout';
import { QuestionsTable } from './QuestionsTable';

export default async function QuestionsPage() {
  const user = await getServerUser();

  if (!user) {
    redirect('/auth/login');
  }

  if (![Role.PLATFORM_OWNER, Role.OPERATION].includes(user.role)) {
    redirect('/403');
  }

  return (
    <AppLayout user={user} currentPath="/questions">
      <QuestionsTable />
    </AppLayout>
  );
}

