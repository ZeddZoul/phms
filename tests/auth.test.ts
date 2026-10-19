import { beforeEach, describe, expect, it } from 'vitest';
import {
  isAuthConfigured,
  isValidDeviceKey,
  isValidPassword,
  isValidSession,
  sessionToken,
} from '@/lib/auth';

// Synthetic test secrets only — never real values
beforeEach(() => {
  process.env.SESSION_SECRET = 'test-secret';
  process.env.DASHBOARD_PASSWORD = 'test-password';
  process.env.DEVICE_API_KEY = 'test-device-key';
});

describe('auth', () => {
  it('reports configured only when both secrets are set', () => {
    expect(isAuthConfigured()).toBe(true);
    delete process.env.DASHBOARD_PASSWORD;
    expect(isAuthConfigured()).toBe(false);
  });

  it('issues a deterministic session token and validates it', () => {
    const token = sessionToken();
    expect(token).toBeTruthy();
    expect(sessionToken()).toBe(token);
    expect(isValidSession(token!)).toBe(true);
  });

  it('rejects tampered or missing session cookies', () => {
    const token = sessionToken()!;
    expect(isValidSession(token.slice(0, -1) + '0')).toBe(false);
    expect(isValidSession(undefined)).toBe(false);
    expect(isValidSession('')).toBe(false);
  });

  it('invalidates sessions when the secret rotates', () => {
    const token = sessionToken()!;
    process.env.SESSION_SECRET = 'rotated';
    expect(isValidSession(token)).toBe(false);
  });

  it('validates the dashboard password (timing-safe equality semantics)', () => {
    expect(isValidPassword('test-password')).toBe(true);
    expect(isValidPassword('wrong')).toBe(false);
    expect(isValidPassword('test-password-longer')).toBe(false);
  });

  it('validates the device key and fails closed when unset', () => {
    expect(isValidDeviceKey('test-device-key')).toBe(true);
    expect(isValidDeviceKey('nope')).toBe(false);
    expect(isValidDeviceKey(null)).toBe(false);
    delete process.env.DEVICE_API_KEY;
    expect(isValidDeviceKey('test-device-key')).toBe(false);
  });
});
