import { StoresTable } from './StoresTable';
import { ProtectedPage } from '@/components/auth/ProtectedPage';
import { Role } from '@/types';

export default function StoresPage() {
  return (
    <ProtectedPage currentPath="/stores" allowedRoles={[Role.PLATFORM_OWNER]}>
      <StoresTable />
    </ProtectedPage>
  );
}

