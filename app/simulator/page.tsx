'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Dices, ImagePlus, Send, Sprout } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import PageHeader from '../components/PageHeader';
import StatusBadge from '../components/StatusBadge';
import HealthGauge from '../components/HealthGauge';
import type { TelemetryRecord } from '@/types/telemetry';

export default function SimulatorPage() {
  const [tempA, setTempA] = useState('25.0');
  const [tempB, setTempB] = useState('25.0');
  const [humA, setHumA] = useState('60');
  const [humB, setHumB] = useState('60');
  const [soilA, setSoilA] = useState('45');
  const [soilB, setSoilB] = useState('45');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TelemetryRecord | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const setImage = (f: File) => {
    setFile(f);
    setPreviewUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return URL.createObjectURL(f);
    });
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setImage(f);
  };

  const useSampleImage = async () => {
    try {
      const blob = await fetch('/sample-plant.webp').then((r) => r.blob());
      setImage(new File([blob], 'sample-plant.webp', { type: 'image/webp' }));
    } catch {
      setError('Failed to load the bundled sample image');
    }
  };

  const randomize = () => {
    // Independent per container — rehearse "A fine, B at risk" scenarios
    setTempA((16 + Math.random() * 22).toFixed(1));
    setTempB((16 + Math.random() * 22).toFixed(1));
    setHumA(String(Math.round(30 + Math.random() * 65)));
    setHumB(String(Math.round(30 + Math.random() * 65)));
    setSoilA(String(Math.round(10 + Math.random() * 75)));
    setSoilB(String(Math.round(10 + Math.random() * 75)));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('Pick a maize & beans image first (or use the sample).');
      return;
    }
    setSubmitting(true);
    setError(null);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('temperatureA', tempA);
      formData.append('temperatureB', tempB);
      formData.append('humidityA', humA);
      formData.append('humidityB', humB);
      formData.append('soilMoistureA', soilA);
      formData.append('soilMoistureB', soilB);

      const response = await fetch('/api/telemetry', {
        method: 'POST',
        body: formData,
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error ?? `Request failed (${response.status})`);
      }

      // The record is now stored — fetch it back to show the AI's verdict
      const latest: TelemetryRecord[] = await fetch(
        '/api/telemetry/history?limit=1'
      ).then((r) => r.json());
      if (latest.length > 0) setResult(latest[0]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  const field = (
    label: string,
    unit: string,
    value: string,
    setValue: (v: string) => void,
    min: number,
    max: number,
    step: number
  ) => (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700">{label}</label>
        <span className="text-sm font-bold text-gray-900">
          {value}
          {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-full accent-deep-green"
      />
    </div>
  );

  return (
    <div className="flex min-h-screen w-full bg-canvas">
      <Sidebar />

      <main className="min-w-0 flex-1 pt-14 lg:pt-0">
        <PageHeader title="Device Simulator" tab="Send telemetry" />

        <div className="grid grid-cols-1 gap-6 p-4 md:p-8 lg:grid-cols-2">
          {/* Input form */}
          <form onSubmit={submit} className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="mb-1 text-xl font-semibold text-gray-900">
              Simulated ESP32 capture
            </h2>
            <p className="mb-6 text-sm text-gray-500">
              Posts multipart form-data to{' '}
              <code className="rounded bg-gray-100 px-1 py-0.5">/api/telemetry</code>{' '}
              exactly like the device would.
            </p>

            <div className="space-y-5">
              <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
                <div className="space-y-5">
                  <div className="text-sm font-semibold text-gray-900">
                    Container A{' '}
                    <span className="font-normal text-gray-500">(left)</span>
                  </div>
                  {field('Temperature', '°C', tempA, setTempA, 5, 45, 0.1)}
                  {field('Humidity', '%', humA, setHumA, 0, 100, 1)}
                  {field('Soil Moisture', '%', soilA, setSoilA, 0, 100, 1)}
                </div>
                <div className="space-y-5">
                  <div className="text-sm font-semibold text-gray-900">
                    Container B{' '}
                    <span className="font-normal text-gray-500">(right)</span>
                  </div>
                  {field('Temperature', '°C', tempB, setTempB, 5, 45, 0.1)}
                  {field('Humidity', '%', humB, setHumB, 0, 100, 1)}
                  {field('Soil Moisture', '%', soilB, setSoilB, 0, 100, 1)}
                </div>
              </div>

              <div>
                <span className="mb-2 block text-sm font-medium text-gray-700">
                  Maize &amp; beans image
                </span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={onFileChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="relative block h-48 w-full overflow-hidden rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 transition-colors hover:border-deep-green"
                >
                  {previewUrl ? (
                    <Image
                      src={previewUrl}
                      alt="Selected plant"
                      fill
                      sizes="(min-width: 1024px) 50vw, 100vw"
                      className="object-cover"
                      unoptimized
                    />
                  ) : (
                    <span className="flex h-full flex-col items-center justify-center gap-2 text-gray-500">
                      <ImagePlus className="h-8 w-8" />
                      <span className="text-sm">Click to choose an image</span>
                    </span>
                  )}
                </button>
                {file && (
                  <div className="mt-1 truncate text-xs text-gray-500">{file.name}</div>
                )}
              </div>

              <div className="flex flex-wrap gap-3 pt-1">
                <button
                  type="button"
                  onClick={useSampleImage}
                  className="flex items-center gap-2 rounded-lg bg-deep-green px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
                >
                  <Sprout className="h-4 w-4" />
                  Use sample image
                </button>
                <button
                  type="button"
                  onClick={randomize}
                  className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                >
                  <Dices className="h-4 w-4" />
                  Randomize values
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-sidebar transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                  {submitting ? 'Analyzing…' : 'Send to AI'}
                </button>
              </div>
            </div>
          </form>

          {/* Result panel */}
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-xl font-semibold text-gray-900">AI verdict</h2>

            {error && (
              <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-red-700">
                {error}
              </div>
            )}

            {submitting ? (
              <div className="flex h-64 items-center justify-center text-gray-500">
                Uploading and waiting for the PHMS AI…
              </div>
            ) : result ? (
              <div className="space-y-4">
                {result.healthScore !== undefined ? (
                  <>
                    <div className="flex items-center gap-6">
                      <HealthGauge score={result.healthScore} />
                      <div className="space-y-2">
                        <StatusBadge status={result.status} />
                        <div className="text-sm text-gray-500">
                          Recorded{' '}
                          {new Date(result.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                    {(result.containerAScore !== undefined ||
                      result.containerBScore !== undefined) && (
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {[
                          {
                            label: 'Container A',
                            side: 'left',
                            score: result.containerAScore,
                            status: result.containerAStatus,
                            diagnosis: result.containerADiagnosis,
                            soil: result.soilMoistureA,
                          },
                          {
                            label: 'Container B',
                            side: 'right',
                            score: result.containerBScore,
                            status: result.containerBStatus,
                            diagnosis: result.containerBDiagnosis,
                            soil: result.soilMoistureB,
                          },
                        ].map(
                          (c) =>
                            c.score !== undefined && (
                              <div
                                key={c.label}
                                className="rounded-xl border border-gray-100 bg-gray-50 p-4"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-semibold text-gray-900">
                                    {c.label}{' '}
                                    <span className="text-xs font-normal text-gray-500">
                                      ({c.side})
                                    </span>
                                  </span>
                                  <StatusBadge status={c.status} />
                                </div>
                                <div className="mt-2 text-2xl font-bold text-gray-900">
                                  {c.score}
                                  <span className="text-sm font-normal text-gray-500">
                                    /100
                                  </span>
                                  {typeof c.soil === 'number' && (
                                    <span className="ml-3 text-sm font-normal text-gray-500">
                                      soil {c.soil}%
                                    </span>
                                  )}
                                </div>
                                {c.diagnosis && (
                                  <p className="mt-1.5 text-sm text-gray-600">
                                    {c.diagnosis}
                                  </p>
                                )}
                              </div>
                            )
                        )}
                      </div>
                    )}
                    {result.diagnosis && (
                      <div>
                        <span className="font-medium text-gray-700">Diagnosis</span>
                        <p className="mt-1 text-gray-600">{result.diagnosis}</p>
                      </div>
                    )}
                    {result.recommendedActions &&
                      result.recommendedActions.length > 0 && (
                        <div>
                          <span className="font-medium text-gray-700">
                            Recommended Actions
                          </span>
                          <ul className="mt-1 list-inside list-disc space-y-1">
                            {result.recommendedActions.map((action, idx) => (
                              <li key={idx} className="text-gray-600">
                                {action}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                  </>
                ) : (
                  <p className="text-gray-600">
                    Telemetry was stored, but the AI assessment was unavailable for
                    this reading (it degrades gracefully). Try again in a moment.
                  </p>
                )}
                <Link
                  href="/"
                  className="inline-block font-medium text-deep-green underline underline-offset-4"
                >
                  View it on the dashboard →
                </Link>
              </div>
            ) : (
              <div className="flex h-64 flex-col items-center justify-center gap-2 text-center text-gray-500">
                <Sprout className="h-8 w-8" />
                <p className="max-w-xs text-sm">
                  Set the telemetry values, pick a maize &amp; beans photo, and send
                  it — the PHMS AI&apos;s assessment will appear here and on the main
                  dashboard.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
