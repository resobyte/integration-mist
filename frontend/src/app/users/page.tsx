import { UsersTable } from './UsersTable';
import { ProtectedPage } from '@/components/auth/ProtectedPage';
import { Role } from '@/types';

export default function UsersPage() {
  return (
    <ProtectedPage currentPath="/users" allowedRoles={[Role.PLATFORM_OWNER]}>
      <UsersTable />
    </ProtectedPage>
  );
}
