import { OrdersTable } from './OrdersTable';
import { ProtectedPage } from '@/components/auth/ProtectedPage';
import { Role } from '@/types';

export default function OrdersPage() {
  return (
    <ProtectedPage currentPath="/orders" allowedRoles={[Role.PLATFORM_OWNER]}>
      <OrdersTable />
    </ProtectedPage>
  );
}

