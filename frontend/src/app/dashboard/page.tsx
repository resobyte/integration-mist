import { DashboardStats } from './DashboardStats';
import { ProtectedPage } from '@/components/auth/ProtectedPage';
import { Role } from '@/types';

export default function DashboardPage() {
  return (
    <ProtectedPage currentPath="/dashboard" allowedRoles={[Role.PLATFORM_OWNER]}>
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold text-foreground font-rubik">Kontrol Paneli</h2>
          <p className="text-muted-foreground mt-1">Sistem performansınızın genel bakışı.</p>
        </div>

        <DashboardStats />
      </div>
    </ProtectedPage>
  );
}
