import { NextRequest, NextResponse } from 'next/server';
import { API_URL } from '@/config/api';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: data.message || 'Invalid credentials' },
        { status: response.status }
      );
    }

    const nextResponse = NextResponse.json({
      success: true,
      user: data.data?.user || data.user,
    });

    const setCookieHeaders = response.headers.getSetCookie();
    const isProduction = process.env.NODE_ENV === 'production';

    for (const cookieHeader of setCookieHeaders) {
      const parts = cookieHeader.split(';');
      const [nameValue] = parts;
      const [name, ...valueParts] = nameValue.split('=');
      const value = valueParts.join('=');

      if (name && value) {
        const cookieName = name.trim();
        const cookieValue = value.trim();

        const cookieOptions: {
          httpOnly: boolean;
          secure: boolean;
          sameSite: 'none' | 'lax';
          path: string;
          maxAge?: number;
          domain?: string;
        } = {
          httpOnly: true,
          secure: isProduction,
          sameSite: (isProduction ? 'none' : 'lax') as 'none' | 'lax',
          path: '/',
        };

        if (isProduction) {
          cookieOptions.domain = '.railway.app';
        }

        const maxAgeMatch = cookieHeader.match(/Max-Age=(\d+)/);
        if (maxAgeMatch) {
          cookieOptions.maxAge = parseInt(maxAgeMatch[1], 10);
        }

        nextResponse.cookies.set(cookieName, cookieValue, cookieOptions);
      }
    }

    return nextResponse;
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'An error occurred' },
      { status: 500 }
    );
  }
}
