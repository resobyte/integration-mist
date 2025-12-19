import { ClaimsTable } from './ClaimsTable';
import { ProtectedPage } from '@/components/auth/ProtectedPage';
import { Role } from '@/types';

export default function ClaimsPage() {
  return (
    <ProtectedPage currentPath="/claims" allowedRoles={[Role.PLATFORM_OWNER, Role.OPERATION]}>
      <ClaimsTable />
    </ProtectedPage>
  );
}
