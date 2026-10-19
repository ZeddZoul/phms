// Pure scoring/alerting logic extracted from the telemetry route so it can
// be unit-tested without the HTTP or database layers.

export interface RecentAssessment {
  healthScore?: number;
  smoothedScore?: number;
  status?: string;
}

/**
 * EWMA smoothing (alpha = 0.4): a trend-stable score that damps
 * single-capture noise from lighting or model variance. Falls back to the
 * most recent raw score when no smoothed value exists yet, and to the raw
 * current score when there is no history at all.
 */
export function computeSmoothedScore(
  raw: number,
  recent: RecentAssessment[]
): number {
  const previous =
    recent.find((r) => typeof r.smoothedScore === 'number')?.smoothedScore ??
    recent.find((r) => typeof r.healthScore === 'number')?.healthScore;
  return previous === undefined ? raw : Math.round(0.4 * raw + 0.6 * previous);
}

/**
 * Alert hysteresis: a single Critical can be noise — the email only fires
 * when the most recent ASSESSED record (unassessed ones are skipped) was
 * also Critical.
 */
export function isSecondConsecutiveCritical(
  recent: RecentAssessment[]
): boolean {
  const previousAssessed = recent.find((r) => r.status);
  return previousAssessed?.status === 'Critical';
}

export type AiErrorKind =
  | 'rate_limited'
  | 'unavailable'
  | 'auth'
  | 'invalid_response'
  | 'unknown';

/** Map an AI call failure to a stable, storable error kind. */
export function classifyAiError(e: unknown): AiErrorKind {
  const status = (e as { status?: number } | null)?.status;
  if (status === 429) return 'rate_limited';
  if (status === 503) return 'unavailable';
  if (status === 401 || status === 403) return 'auth';

  const message = e instanceof Error ? e.message : String(e ?? '');
  if (/api[_ ]?key|permission|unauthori[sz]/i.test(message)) return 'auth';
  if (/quota|rate limit|429/i.test(message)) return 'rate_limited';
  if (/unavailable|overload|high demand|503/i.test(message)) return 'unavailable';
  return 'unknown';
}

export function describeAiError(kind: AiErrorKind): string {
  switch (kind) {
    case 'rate_limited':
      return 'AI rate limit reached — reading stored without assessment';
    case 'unavailable':
      return 'AI temporarily unavailable — reading stored without assessment';
    case 'auth':
      return 'AI authentication failed — check GEMINI_API_KEY';
    case 'invalid_response':
      return 'AI returned an unusable response — reading stored without assessment';
    default:
      return 'AI analysis failed — reading stored without assessment';
  }
}
