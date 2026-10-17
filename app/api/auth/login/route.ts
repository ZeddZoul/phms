import { NextRequest, NextResponse } from 'next/server';
import {
  SESSION_COOKIE,
  isAuthConfigured,
  isValidPassword,
  sessionToken,
} from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    if (!isAuthConfigured()) {
      return NextResponse.json(
        {
          error:
            'Authentication is not configured. Set DASHBOARD_PASSWORD and SESSION_SECRET in .env.local.',
        },
        { status: 500 }
      );
    }

    const body = await request.json();
    const password = typeof body.password === 'string' ? body.password : '';

    if (!isValidPassword(password)) {
      return NextResponse.json({ error: 'Incorrect password' }, { status: 401 });
    }

    const response = NextResponse.json({ ok: true }, { status: 200 });
    response.cookies.set(SESSION_COOKIE, sessionToken()!, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });
    return response;
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
