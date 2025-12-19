'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { AuthUser, Role } from '@/types';
import { getAccessToken } from '@/lib/token';
import { API_URL } from '@/config/api';
import { AppLayout } from '@/components/layouts/AppLayout';
import { isRouteAllowed } from '@/config/routes';

interface ProtectedPageProps {
  children: React.ReactNode;
  currentPath: string;
  allowedRoles?: Role[];
}

export function ProtectedPage({ children, currentPath, allowedRoles }: ProtectedPageProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const accessToken = getAccessToken();

      if (!accessToken) {
        router.push('/auth/login');
        return;
      }

      try {
        const response = await fetch(`${API_URL}/auth/me`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (!response.ok) {
          router.push('/auth/login');
          return;
        }

        const data = await response.json();
        const userData = data.data || data;

        if (!userData) {
          router.push('/auth/login');
          return;
        }

        if (allowedRoles && !allowedRoles.includes(userData.role)) {
          router.push('/403');
          return;
        }

        if (!isRouteAllowed(pathname, userData.role)) {
          router.push('/403');
          return;
        }

        setUser(userData);
      } catch (error) {
        console.error('Auth check error:', error);
        router.push('/auth/login');
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [router, pathname, allowedRoles]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <AppLayout user={user} currentPath={currentPath}>
      {children}
    </AppLayout>
  );
}

