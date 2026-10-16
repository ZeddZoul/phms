// Client-side app settings, persisted in localStorage. Pages read these on
// mount; saving dispatches 'phms-settings-changed' so open components can
// react without a reload.

export interface AppSettings {
  /** Dashboard auto-refresh cadence in seconds */
  refreshIntervalSeconds: 15 | 30 | 60;
  /** Master switch for health alert notifications */
  alertsEnabled: boolean;
  /** Which statuses raise a notification */
  alertStatuses: 'critical' | 'warning-critical';
  /** Default analysis window on the Reports page */
  reportsDefaultLimit: 25 | 50 | 100 | 200;
}

export const DEFAULT_SETTINGS: AppSettings = {
  refreshIntervalSeconds: 30,
  alertsEnabled: true,
  alertStatuses: 'warning-critical',
  reportsDefaultLimit: 100,
};

const STORAGE_KEY = 'phms-settings';

export function loadSettings(): AppSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: AppSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  window.dispatchEvent(new Event('phms-settings-changed'));
}
