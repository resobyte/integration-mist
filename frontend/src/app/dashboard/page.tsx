import { redirect } from 'next/navigation';
import { getServerUser } from '@/lib/auth';
import { AppLayout } from '@/components/layouts/AppLayout';
import { DashboardStats } from './DashboardStats';
import { Role } from '@/types';

export default async function DashboardPage() {
  const user = await getServerUser();

  if (!user) {
    redirect('/auth/login');
  }

  if (user.role !== Role.PLATFORM_OWNER) {
    redirect('/403');
  }

  return (
    <AppLayout user={user} currentPath="/dashboard">
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold text-foreground font-rubik">Kontrol Paneli</h2>
          <p className="text-muted-foreground mt-1">Sistem performansınızın genel bakışı.</p>
        </div>

        <DashboardStats />
      </div>
    </AppLayout>
  );
}
