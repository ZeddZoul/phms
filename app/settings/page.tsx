'use client';

import { useEffect, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import PageHeader from '../components/PageHeader';
import Select from '../components/Select';
import {
  type AppSettings,
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
} from '@/lib/settings';

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);
  const [endpoint, setEndpoint] = useState('/api/telemetry');
  const [copied, setCopied] = useState(false);
  const [alertEmail, setAlertEmail] = useState('');
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [emailStatus, setEmailStatus] = useState<
    'idle' | 'saving' | 'saved' | 'error'
  >('idle');
  const [emailError, setEmailError] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrating client-only values (localStorage settings, window.origin) after mount
    setSettings(loadSettings());
    setEndpoint(`${window.location.origin}/api/telemetry`);

    const loadEmailSettings = async () => {
      try {
        const res = await fetch('/api/settings/alerts');
        if (!res.ok) return;
        const data = await res.json();
        setAlertEmail(data.email ?? '');
        setEmailEnabled(Boolean(data.enabled));
      } catch {
        // endpoint unreachable — leave the form blank
      }
    };
    loadEmailSettings();
  }, []);

  const saveEmailSettings = async (email: string, enabled: boolean) => {
    setEmailStatus('saving');
    setEmailError(null);
    try {
      const res = await fetch('/api/settings/alerts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, enabled }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? 'Failed to save email settings');
      }
      setEmailEnabled(Boolean(data.enabled));
      setEmailStatus('saved');
      setTimeout(() => setEmailStatus('idle'), 2000);
    } catch (err) {
      setEmailStatus('error');
      setEmailError(
        err instanceof Error ? err.message : 'Failed to save email settings'
      );
    }
  };

  const update = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    const next = { ...settings, [key]: value };
    setSettings(next);
    saveSettings(next);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const copyEndpoint = async () => {
    try {
      await navigator.clipboard.writeText(endpoint);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable — user can select the text manually
    }
  };

  return (
    <div className="flex min-h-screen w-full bg-canvas">
      <Sidebar />

      <main className="min-w-0 flex-1">
        <PageHeader title="Settings" tab="Preferences" />

        <div className="max-w-3xl space-y-6 p-4 md:p-8">
          {saved && (
            <div className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">
              Settings saved.
            </div>
          )}

          {/* Dashboard */}
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="mb-1 text-xl font-semibold text-gray-900">Dashboard</h2>
            <p className="mb-5 text-sm text-gray-500">
              How the live dashboard keeps itself up to date.
            </p>
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm font-medium text-gray-700">
                Auto-refresh interval
              </span>
              <Select
                value={settings.refreshIntervalSeconds}
                options={[
                  { value: 15, label: 'Every 15 seconds' },
                  { value: 30, label: 'Every 30 seconds (default)' },
                  { value: 60, label: 'Every 60 seconds' },
                ]}
                onChange={(v) =>
                  update(
                    'refreshIntervalSeconds',
                    v as AppSettings['refreshIntervalSeconds']
                  )
                }
                ariaLabel="Auto-refresh interval"
              />
            </div>
          </div>

          {/* Notifications */}
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="mb-1 text-xl font-semibold text-gray-900">
              Notifications
            </h2>
            <p className="mb-5 text-sm text-gray-500">
              Health alerts shown on the bell at the top right.
            </p>
            <div className="space-y-5">
              <label className="flex items-center justify-between gap-4">
                <span className="text-sm font-medium text-gray-700">
                  Enable health alerts
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={settings.alertsEnabled}
                  onClick={() => update('alertsEnabled', !settings.alertsEnabled)}
                  className={`relative h-6 w-11 rounded-full transition-colors ${
                    settings.alertsEnabled ? 'bg-deep-green' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                      settings.alertsEnabled ? 'left-[22px]' : 'left-0.5'
                    }`}
                  />
                </button>
              </label>
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm font-medium text-gray-700">
                  Alert on status
                </span>
                <Select
                  value={settings.alertStatuses}
                  options={[
                    { value: 'warning-critical', label: 'Warning and Critical' },
                    { value: 'critical', label: 'Critical only' },
                  ]}
                  onChange={(v) =>
                    update('alertStatuses', v as AppSettings['alertStatuses'])
                  }
                  disabled={!settings.alertsEnabled}
                  ariaLabel="Alert on status"
                />
              </div>
            </div>
          </div>

          {/* Reports */}
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="mb-1 text-xl font-semibold text-gray-900">Reports</h2>
            <p className="mb-5 text-sm text-gray-500">
              Default analysis window when opening the Reports page.
            </p>
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm font-medium text-gray-700">
                Default window
              </span>
              <Select
                value={settings.reportsDefaultLimit}
                options={[
                  { value: 25, label: 'Last 25 records' },
                  { value: 50, label: 'Last 50 records' },
                  { value: 100, label: 'Last 100 records (default)' },
                  { value: 200, label: 'Last 200 records' },
                ]}
                onChange={(v) =>
                  update(
                    'reportsDefaultLimit',
                    v as AppSettings['reportsDefaultLimit']
                  )
                }
                ariaLabel="Default reports window"
              />
            </div>
          </div>

          {/* Email alerts */}
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="mb-1 text-xl font-semibold text-gray-900">
              Email Alerts
            </h2>
            <p className="mb-5 text-sm text-gray-500">
              Get an email when an assessment comes back Critical — it includes
              the diagnosis and what you should do. At most one email per hour.
            </p>
            <div className="space-y-5">
              <label className="flex items-center justify-between gap-4">
                <span className="text-sm font-medium text-gray-700">
                  Send email on Critical status
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={emailEnabled}
                  onClick={() => saveEmailSettings(alertEmail, !emailEnabled)}
                  className={`relative h-6 w-11 rounded-full transition-colors ${
                    emailEnabled ? 'bg-deep-green' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                      emailEnabled ? 'left-[22px]' : 'left-0.5'
                    }`}
                  />
                </button>
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="email"
                  value={alertEmail}
                  onChange={(e) => setAlertEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-deep-green focus:outline-none focus:ring-2 focus:ring-deep-green/30"
                />
                <button
                  type="button"
                  onClick={() => saveEmailSettings(alertEmail, emailEnabled)}
                  disabled={emailStatus === 'saving'}
                  className="shrink-0 rounded-lg bg-deep-green px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {emailStatus === 'saving' ? 'Saving…' : 'Save email'}
                </button>
              </div>
              {emailStatus === 'saved' && (
                <p className="text-sm text-green-700">Email settings saved.</p>
              )}
              {emailStatus === 'error' && emailError && (
                <p className="text-sm text-red-600">{emailError}</p>
              )}
            </div>
          </div>

          {/* Connect device */}
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="mb-1 text-xl font-semibold text-gray-900">
              Connect device
            </h2>
            <p className="mb-5 text-sm text-gray-500">
              Point the ESP32-S3-CAM at this endpoint (multipart form-data POST
              with <code className="rounded bg-gray-100 px-1">image</code>,{' '}
              <code className="rounded bg-gray-100 px-1">temperature</code>,{' '}
              <code className="rounded bg-gray-100 px-1">humidity</code>,{' '}
              <code className="rounded bg-gray-100 px-1">soilMoisture</code>).
            </p>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-lg bg-gray-100 px-3 py-2.5 text-sm text-gray-800">
                {endpoint}
              </code>
              <button
                type="button"
                onClick={copyEndpoint}
                className="flex shrink-0 items-center gap-2 rounded-lg bg-deep-green px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
