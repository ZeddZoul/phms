'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import { Activity, Droplets, Thermometer, Wind } from 'lucide-react';
import Sidebar from './components/Sidebar';
import PageHeader from './components/PageHeader';
import StatTile from './components/StatTile';
import StatusBadge from './components/StatusBadge';
import HealthGauge from './components/HealthGauge';
import TrendChart from './components/TrendChart';
import { loadSettings } from '@/lib/settings';
import type { TelemetryRecord } from '@/types/telemetry';

export default function Dashboard() {
  const [currentData, setCurrentData] = useState<TelemetryRecord | null>(null);
  const [historicalData, setHistoricalData] = useState<TelemetryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch current data (latest record)
  const fetchCurrentData = useCallback(async () => {
    try {
      const response = await fetch('/api/telemetry/history?limit=1');
      if (!response.ok) throw new Error('Failed to fetch current data');
      const data: TelemetryRecord[] = await response.json();
      if (data.length > 0) {
        setCurrentData(data[0]);
      }
      setError(null);
    } catch (err) {
      setError('Failed to load current data');
      console.error(err);
    }
  }, []);

  // Fetch historical data for charts
  const fetchHistoricalData = useCallback(async () => {
    try {
      const response = await fetch('/api/telemetry/history?limit=50');
      if (!response.ok) throw new Error('Failed to fetch historical data');
      const data: TelemetryRecord[] = await response.json();
      setHistoricalData([...data].reverse()); // chronological order for charts
      setError(null);
    } catch (err) {
      setError('Failed to load historical data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial data fetch + auto-refresh (30s by default, configurable in Settings)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount: state updates happen after awaited responses, not synchronously
    fetchCurrentData();
    fetchHistoricalData();

    let interval = setInterval(
      () => {
        fetchCurrentData();
        fetchHistoricalData();
      },
      loadSettings().refreshIntervalSeconds * 1000
    );

    const onSettingsChange = () => {
      clearInterval(interval);
      interval = setInterval(
        () => {
          fetchCurrentData();
          fetchHistoricalData();
        },
        loadSettings().refreshIntervalSeconds * 1000
      );
    };
    window.addEventListener('phms-settings-changed', onSettingsChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('phms-settings-changed', onSettingsChange);
    };
  }, [fetchCurrentData, fetchHistoricalData]);

  return (
    <div className="flex min-h-screen w-full bg-canvas">
      <Sidebar />

      <main className="min-w-0 flex-1 pt-14 lg:pt-0">
        <PageHeader title="Plant Health Monitoring Dashboard" tab="Overview" />

        <div className="space-y-6 p-4 md:p-8">
          {error && (
            <div className="rounded-xl bg-red-50 px-4 py-3 text-red-700">
              {error} — retrying automatically every 30 seconds.
            </div>
          )}

          {loading ? (
            <div className="flex h-64 items-center justify-center text-lg text-gray-500">
              Loading dashboard...
            </div>
          ) : !currentData ? (
            !error && (
              <div className="rounded-2xl bg-white p-10 text-center text-gray-500 shadow-sm">
                No data available yet — waiting for the first telemetry from your
                device.
              </div>
            )
          ) : (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Plant image and health assessment */}
              <div className="rounded-2xl bg-white p-6 shadow-sm">
                <h2 className="mb-4 text-xl font-semibold text-gray-900">
                  Current Status
                </h2>
                <div className="relative mb-4 h-64 w-full overflow-hidden rounded-xl">
                  <Image
                    src={currentData.imageUrl}
                    alt="Current plant"
                    fill
                    sizes="(min-width: 1024px) 50vw, 100vw"
                    className="object-cover"
                    unoptimized={currentData.imageUrl.startsWith('data:')}
                  />
                </div>
                {currentData.healthScore !== undefined ? (
                  <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
                    <div className="shrink-0 self-center sm:self-start">
                      <HealthGauge score={currentData.healthScore} />
                      <div className="mt-1 text-center text-sm text-gray-500">
                        Health Score
                      </div>
                    </div>
                    <div className="min-w-0 flex-1 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-700">Status</span>
                        <StatusBadge status={currentData.status} />
                      </div>
                      {(currentData.maizeScore !== undefined ||
                        currentData.beansScore !== undefined) && (
                        <div className="flex flex-wrap gap-2">
                          {currentData.maizeScore !== undefined && (
                            <span className="rounded-lg bg-gray-50 px-3 py-1.5 text-sm">
                              <span className="text-gray-500">Maize</span>{' '}
                              <span className="font-bold text-gray-900">
                                {currentData.maizeScore}/100
                              </span>
                            </span>
                          )}
                          {currentData.beansScore !== undefined && (
                            <span className="rounded-lg bg-gray-50 px-3 py-1.5 text-sm">
                              <span className="text-gray-500">Beans</span>{' '}
                              <span className="font-bold text-gray-900">
                                {currentData.beansScore}/100
                              </span>
                            </span>
                          )}
                        </div>
                      )}
                      {currentData.diagnosis && (
                        <div>
                          <span className="font-medium text-gray-700">Diagnosis</span>
                          <p className="mt-1 text-gray-600">{currentData.diagnosis}</p>
                        </div>
                      )}
                      {currentData.recommendedActions &&
                        currentData.recommendedActions.length > 0 && (
                          <div>
                            <span className="font-medium text-gray-700">
                              Recommended Actions
                            </span>
                            <ul className="mt-1 list-inside list-disc space-y-1">
                              {currentData.recommendedActions.map((action, idx) => (
                                <li key={idx} className="text-gray-600">
                                  {action}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-500">
                    Health assessment unavailable for the latest reading.
                  </p>
                )}
              </div>

              {/* Environmental metrics */}
              <div className="rounded-2xl bg-white p-6 shadow-sm">
                <h2 className="mb-6 text-xl font-semibold text-gray-900">
                  Environmental Conditions
                </h2>
                <div className="space-y-6">
                  <StatTile
                    icon={Thermometer}
                    iconClassName="bg-green-50 text-chart-temp"
                    label="Temperature"
                    value={`${currentData.temperature}°C`}
                  />
                  <StatTile
                    icon={Wind}
                    iconClassName="bg-green-50 text-chart-humidity"
                    label="Humidity"
                    value={`${currentData.humidity}%`}
                  />
                  <StatTile
                    icon={Droplets}
                    iconClassName="bg-lime-50 text-chart-soil"
                    label="Soil Moisture"
                    value={`${currentData.soilMoisture}%`}
                  />
                  <div className="flex items-center gap-4">
                    <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-deep-green/10 text-deep-green">
                      <Activity className="h-6 w-6" />
                    </span>
                    <div>
                      <div className="text-sm text-gray-500">Last Update</div>
                      <div className="text-lg font-medium text-gray-900">
                        {new Date(currentData.timestamp).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Historical trends */}
          {!loading && historicalData.length > 0 && (
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="mb-6 text-xl font-semibold text-gray-900">
                Historical Trends
              </h2>
              <div className="space-y-8">
                <TrendChart
                  title="Temperature Over Time"
                  data={historicalData}
                  dataKey="temperature"
                  stroke="#14532D"
                  gradientId="gradTemp"
                  unit="°C"
                  name="Temperature (°C)"
                  hint="Air temperature around the plants across the last 50 captures. Maize grows best at 21–30°C, beans at 18–27°C."
                />
                <TrendChart
                  title="Humidity Over Time"
                  data={historicalData}
                  dataKey="humidity"
                  stroke="#16A34A"
                  gradientId="gradHumidity"
                  unit="%"
                  name="Humidity (%)"
                  hint="Relative humidity across the last 50 captures. 50–70% is comfortable; sustained levels above ~80% favour fungal disease."
                />
                <TrendChart
                  title="Soil Moisture Over Time"
                  data={historicalData}
                  dataKey="soilMoisture"
                  stroke="#84CC16"
                  gradientId="gradSoil"
                  unit="%"
                  name="Soil Moisture (%)"
                  hint="Soil moisture at root depth across the last 50 captures. Aim for 40–70%; below ~35% the plants need water now."
                />
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
