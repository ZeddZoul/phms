'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import { Activity, Droplets, Thermometer, Wind } from 'lucide-react';
import Sidebar from './components/Sidebar';
import PageHeader from './components/PageHeader';
import StatTile from './components/StatTile';
import StatusBadge from './components/StatusBadge';
import HealthGauge from './components/HealthGauge';
import InfoHint from './components/InfoHint';
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
                  <div className="space-y-3">
                    <div className="min-w-0 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-700">Status</span>
                        <StatusBadge status={currentData.status} />
                      </div>
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
                    {currentData.assessmentError === 'rate_limited' ||
                    currentData.assessmentError === 'unavailable'
                      ? 'The PHMS AI was busy at capture time — the reading was stored and the next capture will be assessed.'
                      : currentData.assessmentError === 'auth'
                        ? 'The PHMS AI could not authenticate — check the AI key in the server environment.'
                        : 'Health assessment unavailable for the latest reading.'}
                  </p>
                )}
              </div>

              {/* Environmental metrics */}
              <div className="rounded-2xl bg-white p-6 shadow-sm">
                <h2 className="mb-5 flex items-center gap-2 text-xl font-semibold text-gray-900">
                  Health Breakdown
                  <InfoHint text="Plant gauges (Maize/Beans) score that plant's visible condition in the photo, judged against its species' tolerances. The Container gauge adds container-level risk from its own readings (soil, crowding, drainage) — it can drop below the plant scores as an early warning to act before damage shows. Ring colors: green ≥70, yellow 40–69, red below 40." />
                </h2>

                {(currentData.containerAScore !== undefined ||
                currentData.containerBScore !== undefined) ? (
                  [
                    {
                      label: 'Container A',
                      side: 'left',
                      probe: 'capacitive',
                      score: currentData.containerAScore,
                      status: currentData.containerAStatus,
                      diagnosis: currentData.containerADiagnosis,
                      soil: currentData.soilMoistureA,
                      temp: currentData.temperatureA ?? currentData.temperature,
                      rh: currentData.humidityA ?? currentData.humidity,
                      maize: currentData.maizeAScore,
                      beans: currentData.beansAScore,
                    },
                    {
                      label: 'Container B',
                      side: 'right',
                      probe: 'resistive',
                      score: currentData.containerBScore,
                      status: currentData.containerBStatus,
                      diagnosis: currentData.containerBDiagnosis,
                      soil: currentData.soilMoistureB,
                      temp: currentData.temperatureB ?? currentData.temperature,
                      rh: currentData.humidityB ?? currentData.humidity,
                      maize: currentData.maizeBScore,
                      beans: currentData.beansBScore,
                    },
                  ].map(
                    (c) =>
                      c.score !== undefined && (
                        <div
                          key={c.label}
                          className="mb-4 rounded-xl border border-gray-100 bg-gray-50 p-4"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-semibold text-gray-900">
                              {c.label}{' '}
                              <span className="text-xs font-normal text-gray-500">
                                ({c.side})
                              </span>
                            </span>
                            <StatusBadge status={c.status} />
                          </div>
                          <div className="mt-0.5 text-xs text-gray-500">
                            {typeof c.soil === 'number'
                              ? `Soil ${c.soil}% (${c.probe}) · `
                              : ''}
                            {c.temp}°C · {c.rh}% RH · photo ({c.side} side)
                          </div>
                          <div className="mt-3 flex items-start justify-around gap-2">
                            <div className="flex flex-col items-center">
                              <HealthGauge score={c.score} size={88} />
                              <span className="mt-1 text-xs font-medium text-gray-700">
                                Container
                              </span>
                            </div>
                            {c.maize !== undefined && (
                              <div className="flex flex-col items-center">
                                <HealthGauge score={c.maize} size={88} />
                                <span className="mt-1 text-xs font-medium text-gray-700">
                                  Maize
                                </span>
                              </div>
                            )}
                            {c.beans !== undefined && (
                              <div className="flex flex-col items-center">
                                <HealthGauge score={c.beans} size={88} />
                                <span className="mt-1 text-xs font-medium text-gray-700">
                                  Beans
                                </span>
                              </div>
                            )}
                          </div>
                          {c.diagnosis && (
                            <p className="mt-2 text-sm text-gray-600">
                              {c.diagnosis}
                            </p>
                          )}
                        </div>
                      )
                  )
                ) : (
                  <p className="mb-4 text-sm text-gray-500">
                    No per-container assessment for the latest record.
                  </p>
                )}

                <h3 className="mb-3 mt-5 border-t border-gray-100 pt-5 text-sm font-semibold uppercase tracking-wide text-gray-500">
                  Environmental Conditions
                </h3>
                {typeof currentData.temperatureA === 'number' &&
                typeof currentData.temperatureB === 'number' &&
                typeof currentData.humidityA === 'number' &&
                typeof currentData.humidityB === 'number' &&
                typeof currentData.soilMoistureA === 'number' &&
                typeof currentData.soilMoistureB === 'number' ? (
                  // One row per container, metrics aligned in columns so A
                  // and B compare at a glance
                  <div className="grid grid-cols-3 gap-x-4 gap-y-3">
                    {[
                      { icon: Thermometer, cls: 'bg-green-50 text-chart-temp', label: 'Temp — A (left)', value: `${currentData.temperatureA}°C` },
                      { icon: Wind, cls: 'bg-green-50 text-chart-humidity', label: 'Humidity — A (left)', value: `${currentData.humidityA}%` },
                      { icon: Droplets, cls: 'bg-lime-50 text-chart-soil', label: 'Soil — A (left)', value: `${currentData.soilMoistureA}%` },
                      { icon: Thermometer, cls: 'bg-green-50 text-chart-temp', label: 'Temp — B (right)', value: `${currentData.temperatureB}°C` },
                      { icon: Wind, cls: 'bg-green-50 text-chart-humidity', label: 'Humidity — B (right)', value: `${currentData.humidityB}%` },
                      { icon: Droplets, cls: 'bg-lime-50 text-chart-soil', label: 'Soil — B (right)', value: `${currentData.soilMoistureB}%` },
                    ].map((t) => (
                      <StatTile
                        key={t.label}
                        icon={t.icon}
                        iconClassName={t.cls}
                        label={t.label}
                        value={t.value}
                        compact
                      />
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3 xl:grid-cols-3">
                    {[
                      ...(typeof currentData.temperatureA === 'number' &&
                      typeof currentData.temperatureB === 'number'
                        ? [
                            { icon: Thermometer, cls: 'bg-green-50 text-chart-temp', label: 'Temp — A (left)', value: `${currentData.temperatureA}°C` },
                            { icon: Thermometer, cls: 'bg-green-50 text-chart-temp', label: 'Temp — B (right)', value: `${currentData.temperatureB}°C` },
                          ]
                        : [
                            { icon: Thermometer, cls: 'bg-green-50 text-chart-temp', label: 'Temperature', value: `${currentData.temperature}°C` },
                          ]),
                      ...(typeof currentData.humidityA === 'number' &&
                      typeof currentData.humidityB === 'number'
                        ? [
                            { icon: Wind, cls: 'bg-green-50 text-chart-humidity', label: 'Humidity — A (left)', value: `${currentData.humidityA}%` },
                            { icon: Wind, cls: 'bg-green-50 text-chart-humidity', label: 'Humidity — B (right)', value: `${currentData.humidityB}%` },
                          ]
                        : [
                            { icon: Wind, cls: 'bg-green-50 text-chart-humidity', label: 'Humidity', value: `${currentData.humidity}%` },
                          ]),
                      ...(typeof currentData.soilMoistureA === 'number' &&
                      typeof currentData.soilMoistureB === 'number'
                        ? [
                            { icon: Droplets, cls: 'bg-lime-50 text-chart-soil', label: 'Soil — A (left)', value: `${currentData.soilMoistureA}%` },
                            { icon: Droplets, cls: 'bg-lime-50 text-chart-soil', label: 'Soil — B (right)', value: `${currentData.soilMoistureB}%` },
                          ]
                        : [
                            { icon: Droplets, cls: 'bg-lime-50 text-chart-soil', label: 'Soil Moisture', value: `${currentData.soilMoisture}%` },
                          ]),
                    ].map((t) => (
                      <StatTile
                        key={t.label}
                        icon={t.icon}
                        iconClassName={t.cls}
                        label={t.label}
                        value={t.value}
                        compact
                      />
                    ))}
                  </div>
                )}
                <div className="mt-4 flex items-center gap-2 text-xs text-gray-500">
                  <Activity className="h-3.5 w-3.5" />
                  Last update {new Date(currentData.timestamp).toLocaleString()}
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
                {historicalData.some(
                  (r) => typeof r.temperatureA === 'number'
                ) ? (
                  <TrendChart
                    title="Temperature Over Time"
                    data={historicalData}
                    dataKey="temperatureA"
                    stroke="#14532D"
                    gradientId="gradTempA"
                    unit="°C"
                    name="Container A (left) °C"
                    series2={{
                      dataKey: 'temperatureB',
                      stroke: '#4D7C0F',
                      gradientId: 'gradTempB',
                      name: 'Container B (right) °C',
                    }}
                    hint="Air temperature at each container (its own DHT11). Maize grows best at 21–30°C, beans at 18–27°C."
                  />
                ) : (
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
                )}
                {historicalData.some(
                  (r) => typeof r.humidityA === 'number'
                ) ? (
                  <TrendChart
                    title="Humidity Over Time"
                    data={historicalData}
                    dataKey="humidityA"
                    stroke="#16A34A"
                    gradientId="gradHumA"
                    unit="%"
                    name="Container A (left) %"
                    series2={{
                      dataKey: 'humidityB',
                      stroke: '#065F46',
                      gradientId: 'gradHumB',
                      name: 'Container B (right) %',
                    }}
                    hint="Relative humidity at each container (its own DHT11). 50–70% is comfortable; sustained levels above ~80% favour fungal disease."
                  />
                ) : (
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
                )}
                {historicalData.some(
                  (r) => typeof r.soilMoistureA === 'number'
                ) ? (
                  <TrendChart
                    title="Soil Moisture Over Time"
                    data={historicalData}
                    dataKey="soilMoistureA"
                    stroke="#84CC16"
                    gradientId="gradSoilA"
                    unit="%"
                    name="Container A (left) %"
                    series2={{
                      dataKey: 'soilMoistureB',
                      stroke: '#3F6212',
                      gradientId: 'gradSoilB',
                      name: 'Container B (right) %',
                    }}
                    hint="Soil moisture per container: A (left, capacitive probe) and B (right, resistive probe). Aim for 40–70%; below ~35% that container needs water now."
                  />
                ) : (
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
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
