import { AuthUser } from '@/types';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

interface AppLayoutProps {
  children: React.ReactNode;
  user: AuthUser;
  currentPath: string;
}

export function AppLayout({ children, user, currentPath }: AppLayoutProps) {
  return (
    <div className="min-h-screen flex bg-background">
      <div className="hidden lg:block">
        <Sidebar userRole={user.role} currentPath={currentPath} />
      </div>
      <div className="flex-1 flex flex-col">
        <Topbar user={user} />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
