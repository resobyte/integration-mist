import { cookies } from 'next/headers';
import { AuthUser, Role } from '@/types';
import { API_URL } from '@/config/api';

export async function getServerUser(): Promise<AuthUser | null> {
  try {
    const cookieStore = cookies();
    const accessToken = cookieStore.get('access_token');

    if (!accessToken) {
      return null;
    }

    const response = await fetch(`${API_URL}/auth/me`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `access_token=${accessToken.value}`,
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.data || data;
  } catch {
    return null;
  }
}

export async function checkServerAuth(): Promise<{
  isAuthenticated: boolean;
  user: AuthUser | null;
}> {
  const user = await getServerUser();
  return {
    isAuthenticated: !!user,
    user,
  };
}

export function hasRole(user: AuthUser | null, roles: Role[]): boolean {
  if (!user) return false;
  return roles.includes(user.role);
}
