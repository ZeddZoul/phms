import { NextRequest, NextResponse } from 'next/server';
import {
  SESSION_COOKIE,
  isAuthConfigured,
  isValidDeviceKey,
  isValidSession,
} from '@/lib/auth';

/**
 * Request guard for the whole app.
 * - POST /api/telemetry: allowed with a valid x-device-key header (the
 *   ESP32) or an owner session (the simulator).
 * - Everything else requires the owner session cookie: API routes get 401,
 *   pages redirect to /login.
 * - When DASHBOARD_PASSWORD / SESSION_SECRET are not configured, the guard
 *   is disabled (local convenience) — configure them before hosting.
 */
export default function proxy(request: NextRequest) {
  if (!isAuthConfigured()) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;
  const session = request.cookies.get(SESSION_COOKIE)?.value;

  if (pathname === '/api/telemetry' && request.method === 'POST') {
    if (
      isValidDeviceKey(request.headers.get('x-device-key')) ||
      isValidSession(session)
    ) {
      return NextResponse.next();
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (isValidSession(session)) {
    return NextResponse.next();
  }

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.redirect(new URL('/login', request.url));
}

export const config = {
  // Public (unguarded) paths: static chunks, favicon, robots.txt, the OG/
  // twitter preview images (link scrapers have no session), the login page,
  // and the auth endpoints themselves.
  matcher: [
    '/((?!_next/|favicon\\.ico|robots\\.txt|opengraph-image|twitter-image|login|api/auth/).*)',
  ],
};
