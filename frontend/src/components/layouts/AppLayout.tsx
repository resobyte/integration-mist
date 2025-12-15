'use client';

import { useState } from 'react';
import { AuthUser } from '@/types';
import { getSidebarRoutesByRole } from '@/config/routes';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

interface AppLayoutProps {
  children: React.ReactNode;
  user: AuthUser;
  currentPath: string;
}

export function AppLayout({ children, user, currentPath }: AppLayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const routes = getSidebarRoutesByRole(user.role);

  return (
    <div className="flex h-screen bg-muted/30">
      <Sidebar 
        routes={routes} 
        currentPath={currentPath} 
        isMobileMenuOpen={isMobileMenuOpen}
        onMobileMenuClose={() => setIsMobileMenuOpen(false)}
      />
      <main className="flex-1 flex flex-col overflow-hidden">
        <Topbar user={user} onMobileMenuOpen={() => setIsMobileMenuOpen(true)} />
        <div className="flex-1 overflow-auto p-6 md:p-8 bg-muted/20">
          {children}
        </div>
      </main>
    </div>
  );
}
