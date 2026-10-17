import crypto from 'crypto';

export const SESSION_COOKIE = 'phms_session';

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/** Auth is enforced only when both secrets are configured. */
export function isAuthConfigured(): boolean {
  return Boolean(process.env.DASHBOARD_PASSWORD && process.env.SESSION_SECRET);
}

/**
 * Stateless session token: HMAC of a fixed label under SESSION_SECRET.
 * Rotating SESSION_SECRET invalidates every existing session.
 */
export function sessionToken(): string | null {
  const secret = process.env.SESSION_SECRET;
  if (!secret) return null;
  return crypto.createHmac('sha256', secret).update('phms-session-v1').digest('hex');
}

export function isValidSession(cookieValue: string | undefined): boolean {
  const token = sessionToken();
  if (!token || !cookieValue) return false;
  return safeEqual(cookieValue, token);
}

export function isValidPassword(password: string): boolean {
  const expected = process.env.DASHBOARD_PASSWORD;
  if (!expected) return false;
  return safeEqual(password, expected);
}

export function isValidDeviceKey(key: string | null): boolean {
  const expected = process.env.DEVICE_API_KEY;
  if (!expected || !key) return false;
  return safeEqual(key, expected);
}
