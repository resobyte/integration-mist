'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AuthUser } from '@/types';
import { API_URL } from '@/config/api';

interface LoginResult {
  success: boolean;
  error?: string;
  user?: AuthUser;
}

export async function login(
  email: string,
  password: string
): Promise<LoginResult> {
  try {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.message || 'Invalid credentials',
      };
    }

    const setCookieHeaders = response.headers.getSetCookie();
    const cookieStore = cookies();
    const isProduction = process.env.NODE_ENV === 'production';
    const cookieOptions = {
      httpOnly: true,
      secure: isProduction,
      sameSite: (isProduction ? 'none' : 'lax') as 'none' | 'lax',
      path: '/',
      ...(isProduction && { domain: '.railway.app' }),
    };

    for (const cookieHeader of setCookieHeaders) {
      const parts = cookieHeader.split(';');
      const [nameValue] = parts;
      const [name, ...valueParts] = nameValue.split('=');
      const value = valueParts.join('=');
      
      if (name && value) {
        const isRefresh = name.trim().includes('refresh');
        cookieStore.set(name.trim(), value.trim(), {
          ...cookieOptions,
          maxAge: isRefresh ? 7 * 24 * 60 * 60 : 24 * 60 * 60,
        });
      }
    }

    const user = data.data?.user || data.user;
    return {
      success: true,
      user,
    };
  } catch (error) {
    return {
      success: false,
      error: 'An error occurred. Please try again.',
    };
  }
}

export async function logout(): Promise<void> {
  const cookieStore = cookies();
  const accessToken = cookieStore.get('access_token');

  try {
    if (accessToken) {
      await fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `access_token=${accessToken.value}`,
        },
        credentials: 'include',
      });
    }
  } catch (error) {
    console.error('Logout error:', error);
  }

  cookieStore.delete('access_token');
  cookieStore.delete('refresh_token');
  redirect('/auth/login');
}

export async function refreshAccessToken(): Promise<boolean> {
  const cookieStore = cookies();
  const refreshToken = cookieStore.get('refresh_token');

  if (!refreshToken) {
    return false;
  }

  try {
    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `refresh_token=${refreshToken.value}`,
      },
      credentials: 'include',
    });

    if (!response.ok) {
      return false;
    }

    const setCookieHeaders = response.headers.getSetCookie();
    const isProduction = process.env.NODE_ENV === 'production';
    const cookieOptions = {
      httpOnly: true,
      secure: isProduction,
      sameSite: (isProduction ? 'none' : 'lax') as 'none' | 'lax',
      path: '/',
      ...(isProduction && { domain: '.railway.app' }),
    };

    for (const cookieHeader of setCookieHeaders) {
      const parts = cookieHeader.split(';');
      const [nameValue] = parts;
      const [name, ...valueParts] = nameValue.split('=');
      const value = valueParts.join('=');
      
      if (name && value) {
        const isRefresh = name.trim().includes('refresh');
        cookieStore.set(name.trim(), value.trim(), {
          ...cookieOptions,
          maxAge: isRefresh ? 7 * 24 * 60 * 60 : 24 * 60 * 60,
        });
      }
    }

    return true;
  } catch {
    return false;
  }
}

