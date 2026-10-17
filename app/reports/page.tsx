'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Download, Droplets, Gauge, Thermometer, Wind } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import PageHeader from '../components/PageHeader';
import Select from '../components/Select';
import InfoHint from '../components/InfoHint';
import StatusBadge from '../components/StatusBadge';
import { loadSettings } from '@/lib/settings';
import type { TelemetryRecord } from '@/types/telemetry';

const WINDOWS = [25, 50, 100, 200] as const;

interface MetricStats {
  avg: number;
  min: number;
  max: number;
}

function metricStats(values: number[]): MetricStats {
  const sum = values.reduce((s, v) => s + v, 0);
  return {
    avg: Math.round((sum / values.length) * 10) / 10,
    min: Math.min(...values),
    max: Math.max(...values),
  };
}

export default function ReportsPage() {
  const [records, setRecords] = useState<TelemetryRecord[]>([]);
  const [limit, setLimit] = useState<number>(
    () => loadSettings().reportsDefaultLimit
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState('Insights');

  const fetchRecords = useCallback(async (n: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/telemetry/history?limit=${n}`);
      if (!res.ok) throw new Error('Failed to fetch records');
      setRecords(await res.json());
    } catch (err) {
      setError('Failed to load report data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount: state updates happen after awaited responses, not synchronously
    fetchRecords(limit);
  }, [fetchRecords, limit]);

  // Records arrive newest-first; charts want chronological order
  const chartData = useMemo(() => [...records].reverse(), [records]);
  const assessed = useMemo(
    () => records.filter((r) => typeof r.healthScore === 'number'),
    [records]
  );
  const scoreData = useMemo(
    () => chartData.filter((r) => typeof r.healthScore === 'number'),
    [chartData]
  );

  const stats = useMemo(() => {
    if (records.length === 0) return null;
    return {
      temperature: metricStats(records.map((r) => r.temperature)),
      humidity: metricStats(records.map((r) => r.humidity)),
      soilMoisture: metricStats(records.map((r) => r.soilMoisture)),
      avgScore:
        assessed.length > 0
          ? Math.round(
              assessed.reduce((s, r) => s + (r.healthScore ?? 0), 0) /
                assessed.length
            )
          : null,
      statusCounts: {
        Healthy: assessed.filter((r) => r.status === 'Healthy').length,
        Warning: assessed.filter((r) => r.status === 'Warning').length,
        Critical: assessed.filter((r) => r.status === 'Critical').length,
      },
    };
  }, [records, assessed]);

  const formatTime = (timestamp: string) =>
    new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });

  const exportCsv = () => {
    const header =
      'timestamp,temperature,humidity,soilMoisture,healthScore,smoothedScore,maizeScore,beansScore,status,diagnosis';
    const rows = records.map((r) =>
      [
        r.timestamp,
        r.temperature,
        r.humidity,
        r.soilMoisture,
        r.healthScore ?? '',
        r.smoothedScore ?? '',
        r.maizeScore ?? '',
        r.beansScore ?? '',
        r.status ?? '',
        `"${(r.diagnosis ?? '').replaceAll('"', '""')}"`,
      ].join(',')
    );
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `phms-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const statCard = (
    icon: React.ReactNode,
    label: string,
    value: string,
    sub: string
  ) => (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        {icon}
        <span className="text-sm text-gray-500">{label}</span>
      </div>
      <div className="mt-2 text-2xl font-bold text-gray-900">{value}</div>
      <div className="mt-0.5 text-xs text-gray-500">{sub}</div>
    </div>
  );

  const distributionBar = (
    label: 'Healthy' | 'Warning' | 'Critical',
    count: number,
    total: number,
    barClass: string
  ) => {
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    return (
      <div key={label}>
        <div className="mb-1 flex items-center justify-between text-sm">
          <span className="font-medium text-gray-700">{label}</span>
          <span className="text-gray-500">
            {count} ({pct}%)
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            className={`h-full rounded-full ${barClass}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="flex min-h-screen w-full bg-canvas">
      <Sidebar />

      <main className="min-w-0 flex-1 pt-14 lg:pt-0">
        <PageHeader
          title="Reports"
          tabs={['Insights', 'Records']}
          activeTab={tab}
          onTabChange={setTab}
        />

        <div className="space-y-6 p-4 md:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              Analysis window
              <Select
                value={limit}
                options={WINDOWS.map((w) => ({
                  value: w as number,
                  label: `Last ${w} records`,
                }))}
                onChange={setLimit}
                ariaLabel="Analysis window"
              />
            </div>
            <button
              type="button"
              onClick={exportCsv}
              disabled={records.length === 0}
              className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-sidebar transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
          </div>

          {error && (
            <div className="rounded-xl bg-red-50 px-4 py-3 text-red-700">{error}</div>
          )}

          {loading ? (
            <div className="flex h-64 items-center justify-center text-lg text-gray-500">
              Loading report…
            </div>
          ) : records.length === 0 ? (
            <div className="rounded-2xl bg-white p-10 text-center text-gray-500 shadow-sm">
              No data to report on yet.
            </div>
          ) : (
            stats &&
            tab === 'Insights' ? (
              <>
                {/* Summary stats */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {statCard(
                    <Thermometer className="h-5 w-5 text-chart-temp" />,
                    'Avg Temperature',
                    `${stats.temperature.avg}°C`,
                    `min ${stats.temperature.min}°C · max ${stats.temperature.max}°C`
                  )}
                  {statCard(
                    <Wind className="h-5 w-5 text-chart-humidity" />,
                    'Avg Humidity',
                    `${stats.humidity.avg}%`,
                    `min ${stats.humidity.min}% · max ${stats.humidity.max}%`
                  )}
                  {statCard(
                    <Droplets className="h-5 w-5 text-chart-soil" />,
                    'Avg Soil Moisture',
                    `${stats.soilMoisture.avg}%`,
                    `min ${stats.soilMoisture.min}% · max ${stats.soilMoisture.max}%`
                  )}
                  {statCard(
                    <Gauge className="h-5 w-5 text-deep-green" />,
                    'Avg Health Score',
                    stats.avgScore !== null ? `${stats.avgScore}/100` : '—',
                    `${assessed.length} of ${records.length} records assessed`
                  )}
                </div>

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                  {/* Status distribution */}
                  <div className="rounded-2xl bg-white p-6 shadow-sm">
                    <h2 className="mb-5 flex items-center gap-2 text-xl font-semibold text-gray-900">
                      Status Distribution
                      <InfoHint text="Share of AI assessments in this window that came back Healthy, Warning, or Critical. Records without an assessment are excluded." />
                    </h2>
                    {assessed.length === 0 ? (
                      <p className="text-sm text-gray-500">
                        No assessed records in this window.
                      </p>
                    ) : (
                      <div className="space-y-4">
                        {distributionBar(
                          'Healthy',
                          stats.statusCounts.Healthy,
                          assessed.length,
                          'bg-green-500'
                        )}
                        {distributionBar(
                          'Warning',
                          stats.statusCounts.Warning,
                          assessed.length,
                          'bg-yellow-500'
                        )}
                        {distributionBar(
                          'Critical',
                          stats.statusCounts.Critical,
                          assessed.length,
                          'bg-red-500'
                        )}
                      </div>
                    )}
                  </div>

                  {/* Health score over time */}
                  <div className="rounded-2xl bg-white p-6 shadow-sm lg:col-span-2">
                    <h2 className="mb-5 flex items-center gap-2 text-xl font-semibold text-gray-900">
                      Health Score Over Time
                      <InfoHint text="The AI's 0–100 health score for each assessed capture. The solid line is the smoothed trend (EWMA) that damps single-capture noise; the dashed line is each raw score. 70+ Healthy, 40–69 Warning, below 40 Critical." />
                    </h2>
                    {scoreData.length === 0 ? (
                      <p className="text-sm text-gray-500">
                        No assessed records in this window.
                      </p>
                    ) : (
                      <ResponsiveContainer width="100%" height={240}>
                        <AreaChart
                          data={scoreData}
                          margin={{ top: 4, right: 16, bottom: 4, left: 0 }}
                        >
                          <defs>
                            <linearGradient id="gradScore" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#17352C" stopOpacity={0.25} />
                              <stop offset="100%" stopColor="#17352C" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                          <XAxis
                            dataKey="timestamp"
                            tickFormatter={formatTime}
                            tick={{ fontSize: 12, fill: '#6B7280' }}
                          />
                          <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#6B7280' }} />
                          <Tooltip
                            labelFormatter={(label) => new Date(label as string).toLocaleString()}
                          />
                          <Legend />
                          <Area
                            type="monotone"
                            dataKey="healthScore"
                            stroke="#9CA3AF"
                            strokeWidth={1.5}
                            strokeDasharray="4 3"
                            fill="transparent"
                            name="Raw score"
                            dot={false}
                          />
                          <Area
                            type="monotone"
                            dataKey="smoothedScore"
                            stroke="#17352C"
                            strokeWidth={2}
                            fill="url(#gradScore)"
                            name="Smoothed trend"
                            connectNulls
                            dot={false}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>

                {/* Combined environmental chart */}
                <div className="rounded-2xl bg-white p-6 shadow-sm">
                  <h2 className="mb-5 flex items-center gap-2 text-xl font-semibold text-gray-900">
                    Environmental Metrics
                    <InfoHint text="Temperature, humidity and soil moisture readings across the window, overlaid on one timeline to make correlations easy to spot." />
                  </h2>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart
                      data={chartData}
                      margin={{ top: 4, right: 16, bottom: 4, left: 0 }}
                    >
                      <defs>
                        <linearGradient id="repTemp" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#14532D" stopOpacity={0.2} />
                          <stop offset="100%" stopColor="#14532D" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="repHum" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#16A34A" stopOpacity={0.2} />
                          <stop offset="100%" stopColor="#16A34A" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="repSoil" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#84CC16" stopOpacity={0.2} />
                          <stop offset="100%" stopColor="#84CC16" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                      <XAxis
                        dataKey="timestamp"
                        tickFormatter={formatTime}
                        tick={{ fontSize: 12, fill: '#6B7280' }}
                      />
                      <YAxis tick={{ fontSize: 12, fill: '#6B7280' }} />
                      <Tooltip
                        labelFormatter={(label) => new Date(label as string).toLocaleString()}
                      />
                      <Legend />
                      <Area type="monotone" dataKey="temperature" stroke="#14532D" strokeWidth={2} fill="url(#repTemp)" name="Temperature (°C)" dot={false} />
                      <Area type="monotone" dataKey="humidity" stroke="#16A34A" strokeWidth={2} fill="url(#repHum)" name="Humidity (%)" dot={false} />
                      <Area type="monotone" dataKey="soilMoisture" stroke="#84CC16" strokeWidth={2} fill="url(#repSoil)" name="Soil Moisture (%)" dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

              </>
            ) : (
              /* Records tab — the raw capture log */
              <div className="rounded-2xl bg-white p-6 shadow-sm">
                <h2 className="mb-5 flex items-center gap-2 text-xl font-semibold text-gray-900">
                  Records
                  <InfoHint text="The raw capture log for this window, newest first — the same rows the CSV export contains." />
                </h2>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px] text-left text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500">
                          <th className="pb-3 pr-4 font-medium">Time</th>
                          <th className="pb-3 pr-4 font-medium">Temp</th>
                          <th className="pb-3 pr-4 font-medium">Humidity</th>
                          <th className="pb-3 pr-4 font-medium">Soil Moisture</th>
                          <th className="pb-3 pr-4 font-medium">Score</th>
                          <th className="pb-3 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {records.map((r) => (
                          <tr key={r._id}>
                            <td className="py-3 pr-4 text-gray-700">
                              {new Date(r.timestamp).toLocaleString()}
                            </td>
                            <td className="py-3 pr-4 font-medium text-gray-900">
                              {r.temperature}°C
                            </td>
                            <td className="py-3 pr-4 font-medium text-gray-900">
                              {r.humidity}%
                            </td>
                            <td className="py-3 pr-4 font-medium text-gray-900">
                              {r.soilMoisture}%
                            </td>
                            <td className="py-3 pr-4 font-medium text-gray-900">
                              {r.healthScore !== undefined ? `${r.healthScore}/100` : '—'}
                            </td>
                            <td className="py-3">
                              <StatusBadge status={r.status} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
              </div>
            )
          )}
        </div>
      </main>
    </div>
  );
}
