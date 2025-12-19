import { CreateTestOrderForm } from './CreateTestOrderForm';
import { ProtectedPage } from '@/components/auth/ProtectedPage';
import { Role } from '@/types';

export default function TestOrderPage() {
  return (
    <ProtectedPage currentPath="/test-order" allowedRoles={[Role.PLATFORM_OWNER]}>
      <CreateTestOrderForm />
    </ProtectedPage>
  );
}

