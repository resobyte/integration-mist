import { redirect } from 'next/navigation';
import { getServerUser } from '@/lib/auth';
import { AppLayout } from '@/components/layouts/AppLayout';
import { Role } from '@/types';
import { ProductsTable } from './ProductsTable';

export default async function ProductsPage() {
  const user = await getServerUser();

  if (!user) {
    redirect('/auth/login');
  }

  if (user.role !== Role.PLATFORM_OWNER) {
    redirect('/403');
  }

  return (
    <AppLayout user={user} currentPath="/products">
      <ProductsTable />
    </AppLayout>
  );
}

