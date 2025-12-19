import { RoutesTable } from './RoutesTable';
import { ProtectedPage } from '@/components/auth/ProtectedPage';
import { Role } from '@/types';

export default function RoutesPage() {
  return (
    <ProtectedPage currentPath="/routes" allowedRoles={[Role.PLATFORM_OWNER]}>
      <RoutesTable />
    </ProtectedPage>
  );
}

