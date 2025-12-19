import { ProductsTable } from './ProductsTable';
import { ProtectedPage } from '@/components/auth/ProtectedPage';
import { Role } from '@/types';

export default function ProductsPage() {
  return (
    <ProtectedPage currentPath="/products" allowedRoles={[Role.PLATFORM_OWNER]}>
      <ProductsTable />
    </ProtectedPage>
  );
}

