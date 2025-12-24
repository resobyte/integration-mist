'use client';

import { getAccessToken, getRefreshToken, setTokens, clearTokens } from './token';
import { API_URL } from '@/config/api';

export async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = getRefreshToken();

  if (!refreshToken) {
    console.warn('Refresh token not found in localStorage');
    return false;
  }

  try {
    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
      console.warn('Refresh token request failed:', response.status, response.statusText);
      const errorData = await response.json().catch(() => ({}));
      console.warn('Refresh error details:', errorData);
      return false;
    }

    const data = await response.json();

    if (data.accessToken && data.refreshToken) {
      setTokens(data.accessToken, data.refreshToken);
      return true;
    }

    if (data.data?.accessToken && data.data?.refreshToken) {
      setTokens(data.data.accessToken, data.data.refreshToken);
      return true;
    }

    console.warn('Refresh response missing tokens:', data);
    return false;
  } catch (error) {
    console.error('Refresh token error:', error);
    return false;
  }
}

export async function logout(): Promise<void> {
  const accessToken = getAccessToken();

  try {
    if (accessToken) {
      await fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
      });
    }
  } catch (error) {
    console.error('Logout error:', error);
  }

  clearTokens();
  window.location.href = '/auth/login';
}

export function isAuthenticated(): boolean {
  return !!getAccessToken();
}



