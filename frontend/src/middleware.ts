import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { publicRoutes, isRouteAllowed, getDefaultRouteByRole } from '@/config/routes';
import { Role } from '@/types';
import { API_URL } from '@/config/api';

async function verifyToken(accessToken: string): Promise<{ role: Role } | null> {
  try {
    const response = await fetch(`${API_URL}/auth/me`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `access_token=${accessToken}`,
      },
      credentials: 'include',
      cache: 'no-store',
    });

    if (!response.ok) {
      if (response.status === 401) {
        return null;
      }
      return null;
    }

    const data = await response.json();
    const user = data.data || data;
    return { role: user.role as Role };
  } catch {
    return null;
  }
}

interface RefreshResult {
  success: boolean;
  accessToken?: string;
  refreshToken?: string;
}

async function refreshTokens(refreshToken: string): Promise<RefreshResult> {
  try {
    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `refresh_token=${refreshToken}`,
      },
      credentials: 'include',
      cache: 'no-store',
    });

    if (!response.ok) {
      return { success: false };
    }

    const setCookieHeaders = response.headers.getSetCookie();
    let newAccessToken: string | undefined;
    let newRefreshToken: string | undefined;

    for (const cookieHeader of setCookieHeaders) {
      const parts = cookieHeader.split(';');
      const [nameValue] = parts;
      const [name, ...valueParts] = nameValue.split('=');
      const value = valueParts.join('=');

      if (name?.trim() === 'access_token') {
        newAccessToken = value.trim();
      } else if (name?.trim() === 'refresh_token') {
        newRefreshToken = value.trim();
      }
    }

    return {
      success: true,
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  } catch {
    return { success: false };
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route));
  let accessToken = request.cookies.get('access_token')?.value;
  const refreshToken = request.cookies.get('refresh_token')?.value;

  if (isPublicRoute) {
    if (accessToken) {
      const user = await verifyToken(accessToken);
      if (user) {
        const defaultRoute = getDefaultRouteByRole(user.role);
        return NextResponse.redirect(new URL(defaultRoute, request.url));
      }
    }
    return NextResponse.next();
  }

  let user = accessToken ? await verifyToken(accessToken) : null;

  if (!user && refreshToken) {
    const refreshResult = await refreshTokens(refreshToken);

    if (refreshResult.success && refreshResult.accessToken) {
      accessToken = refreshResult.accessToken;
      user = await verifyToken(accessToken);

      if (user) {
        const isProduction = process.env.NODE_ENV === 'production';
        const cookieOptions = {
          httpOnly: true,
          secure: isProduction,
          sameSite: (isProduction ? 'none' : 'lax') as 'none' | 'lax',
          path: '/',
          ...(isProduction && { domain: '.railway.app' }),
        };

        const response = NextResponse.next();

        response.cookies.set('access_token', refreshResult.accessToken, {
          ...cookieOptions,
          maxAge: 15 * 60,
        });

        if (refreshResult.refreshToken) {
          response.cookies.set('refresh_token', refreshResult.refreshToken, {
            ...cookieOptions,
            maxAge: 7 * 24 * 60 * 60,
          });
        }

        if (pathname === '/') {
          const defaultRoute = getDefaultRouteByRole(user.role);
          const redirectResponse = NextResponse.redirect(new URL(defaultRoute, request.url));
          redirectResponse.cookies.set('access_token', refreshResult.accessToken, {
            ...cookieOptions,
            maxAge: 15 * 60,
          });
          if (refreshResult.refreshToken) {
            redirectResponse.cookies.set('refresh_token', refreshResult.refreshToken, {
              ...cookieOptions,
              maxAge: 7 * 24 * 60 * 60,
            });
          }
          return redirectResponse;
        }

        if (!isRouteAllowed(pathname, user.role)) {
          return NextResponse.redirect(new URL('/403', request.url));
        }

        return response;
      }
    }
  }

  if (!user) {
    const response = NextResponse.redirect(new URL('/auth/login', request.url));
    response.cookies.delete('access_token');
    response.cookies.delete('refresh_token');
    return response;
  }

  if (pathname === '/') {
    const defaultRoute = getDefaultRouteByRole(user.role);
    return NextResponse.redirect(new URL(defaultRoute, request.url));
  }

  if (!isRouteAllowed(pathname, user.role)) {
    return NextResponse.redirect(new URL('/403', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
