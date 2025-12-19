'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getDefaultRouteByRole } from '@/config/routes';
import { getAccessToken } from '@/lib/token';
import { API_URL } from '@/config/api';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    const accessToken = getAccessToken();

    if (!accessToken) {
      router.push('/auth/login');
      return;
    }

    fetch(`${API_URL}/auth/me`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    })
      .then((response) => {
        if (!response.ok) {
          router.push('/auth/login');
          return;
        }
        return response.json();
      })
      .then((data) => {
        if (data?.data || data) {
          const user = data.data || data;
          const redirectUrl = getDefaultRouteByRole(user.role);
          router.push(redirectUrl);
        } else {
          router.push('/auth/login');
        }
      })
      .catch(() => {
        router.push('/auth/login');
      });
  }, [router]);

  return null;
}
