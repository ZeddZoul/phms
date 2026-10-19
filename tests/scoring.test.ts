import { describe, expect, it } from 'vitest';
import {
  classifyAiError,
  computeSmoothedScore,
  isSecondConsecutiveCritical,
} from '@/lib/scoring';

describe('computeSmoothedScore', () => {
  it('returns the raw score when there is no history', () => {
    expect(computeSmoothedScore(55, [])).toBe(55);
  });

  it('applies EWMA alpha=0.4 against the previous smoothed score', () => {
    // 0.4 * 15 + 0.6 * 25 = 21
    expect(computeSmoothedScore(15, [{ smoothedScore: 25 }])).toBe(21);
  });

  it('uses the MOST RECENT smoothed score (list is newest-first)', () => {
    expect(
      computeSmoothedScore(50, [{ smoothedScore: 80 }, { smoothedScore: 10 }])
    ).toBe(Math.round(0.4 * 50 + 0.6 * 80));
  });

  it('falls back to the most recent raw healthScore when no smoothed value exists', () => {
    // 0.4 * 55 + 0.6 * 82 = 71.2 -> 71
    expect(computeSmoothedScore(55, [{ healthScore: 82 }])).toBe(71);
  });

  it('skips unassessed records when finding the fallback', () => {
    expect(computeSmoothedScore(40, [{}, {}, { healthScore: 60 }])).toBe(
      Math.round(0.4 * 40 + 0.6 * 60)
    );
  });
});

describe('isSecondConsecutiveCritical', () => {
  it('is false with no history (first Critical is deferred)', () => {
    expect(isSecondConsecutiveCritical([])).toBe(false);
  });

  it('is true when the most recent assessed record was Critical', () => {
    expect(isSecondConsecutiveCritical([{ status: 'Critical' }])).toBe(true);
  });

  it('is false when the most recent assessed record was Warning', () => {
    expect(
      isSecondConsecutiveCritical([{ status: 'Warning' }, { status: 'Critical' }])
    ).toBe(false);
  });

  it('skips unassessed records in between', () => {
    expect(
      isSecondConsecutiveCritical([{}, {}, { status: 'Critical' }])
    ).toBe(true);
  });
});

describe('classifyAiError', () => {
  it('classifies HTTP status codes', () => {
    expect(classifyAiError({ status: 429 })).toBe('rate_limited');
    expect(classifyAiError({ status: 503 })).toBe('unavailable');
    expect(classifyAiError({ status: 401 })).toBe('auth');
    expect(classifyAiError({ status: 403 })).toBe('auth');
  });

  it('falls back to message heuristics', () => {
    expect(
      classifyAiError(new Error('This model is currently experiencing high demand.'))
    ).toBe('unavailable');
    expect(classifyAiError(new Error('Rate limit exceeded for quota'))).toBe(
      'rate_limited'
    );
    expect(
      classifyAiError(new Error('GEMINI_API_KEY environment variable is not set'))
    ).toBe('auth');
  });

  it('returns unknown for anything else', () => {
    expect(classifyAiError(new Error('socket hang up'))).toBe('unknown');
    expect(classifyAiError(undefined)).toBe('unknown');
  });
});
