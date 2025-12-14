import { redirect } from 'next/navigation';
import { getServerUser } from '@/lib/auth';
import { AppLayout } from '@/components/layouts/AppLayout';
import { AccountForm } from './AccountForm';

export default async function AccountPage() {
  const user = await getServerUser();

  if (!user) {
    redirect('/auth/login');
  }

  return (
    <AppLayout user={user} currentPath="/account">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Account</h1>
          <p className="text-muted-foreground">Manage your account settings</p>
        </div>

        <div className="bg-card rounded-lg border border-border p-6 max-w-2xl">
          <h2 className="text-lg font-semibold mb-4">Profile Information</h2>
          <AccountForm user={user} />
        </div>
      </div>
    </AppLayout>
  );
}
