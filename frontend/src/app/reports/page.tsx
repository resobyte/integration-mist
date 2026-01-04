import { ReportsTable } from './ReportsTable';
import { ProtectedPage } from '@/components/auth/ProtectedPage';
import { Role } from '@/types';

export default function ReportsPage() {
  return (
    <ProtectedPage currentPath="/reports" allowedRoles={[Role.PLATFORM_OWNER]}>
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold text-foreground font-rubik">Raporlar</h2>
          <p className="text-muted-foreground mt-1">Tarih bazlı detaylı raporlar ve istatistikler.</p>
        </div>

        <ReportsTable />
      </div>
    </ProtectedPage>
  );
}








