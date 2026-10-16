'use client';

import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import StatusBadge from './StatusBadge';
import { loadSettings } from '@/lib/settings';
import type { TelemetryRecord } from '@/types/telemetry';

const LAST_SEEN_KEY = 'phms-notifications-last-seen';

export default function NotificationsBell() {
  const [alerts, setAlerts] = useState<TelemetryRecord[]>([]);
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [statuses, setStatuses] = useState<string[]>(['Warning', 'Critical']);
  const [lastSeen, setLastSeen] = useState<number>(() =>
    typeof window === 'undefined'
      ? Number.MAX_SAFE_INTEGER
      : Number(localStorage.getItem(LAST_SEEN_KEY) ?? 0)
  );

  // Track notification preferences from Settings (same-tab updates included)
  useEffect(() => {
    const apply = () => {
      const s = loadSettings();
      setEnabled(s.alertsEnabled);
      setStatuses(
        s.alertStatuses === 'critical' ? ['Critical'] : ['Warning', 'Critical']
      );
    };
    apply();
    window.addEventListener('phms-settings-changed', apply);
    return () => window.removeEventListener('phms-settings-changed', apply);
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await fetch('/api/telemetry/history?limit=25');
        if (!res.ok) return;
        const data: TelemetryRecord[] = await res.json();
        if (!active) return;
        setAlerts(
          data.filter((r) => r.status && statuses.includes(r.status)).slice(0, 10)
        );
      } catch {
        // network hiccup — keep previous alerts, retry on next cycle
      }
    };
    load();
    const interval = setInterval(load, 60000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [statuses]);

  const unread = enabled
    ? alerts.filter((a) => new Date(a.timestamp).getTime() > lastSeen).length
    : 0;

  const toggle = () => {
    setOpen((o) => {
      const next = !o;
      if (next) {
        const now = Date.now();
        localStorage.setItem(LAST_SEEN_KEY, String(now));
        setLastSeen(now);
      }
      return next;
    });
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-label={
          unread > 0 ? `Notifications (${unread} unread)` : 'Notifications'
        }
        className="relative flex h-10 w-10 items-center justify-center rounded-full text-gray-600 transition-colors hover:bg-gray-100"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-white" />
        )}
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Close notifications"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border border-gray-200 bg-white shadow-lg">
            <div className="border-b border-gray-100 px-4 py-3 font-semibold text-gray-900">
              Notifications
            </div>
            {!enabled ? (
              <div className="px-4 py-6 text-center text-sm text-gray-500">
                Health alerts are disabled in Settings.
              </div>
            ) : alerts.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-gray-500">
                No alerts — the plants look fine.
              </div>
            ) : (
              <ul className="max-h-96 divide-y divide-gray-100 overflow-y-auto">
                {alerts.map((a) => (
                  <li key={a._id} className="px-4 py-3">
                    <div className="flex items-center justify-between">
                      <StatusBadge status={a.status} />
                      <span className="text-xs text-gray-500">
                        {new Date(a.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-sm text-gray-600">
                      Health score {a.healthScore}/100
                      {a.diagnosis ? ` — ${a.diagnosis}` : ''}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
