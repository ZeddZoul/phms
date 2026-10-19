'use client';

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
import InfoHint from './InfoHint';
import type { TelemetryRecord } from '@/types/telemetry';

interface SecondSeries {
  dataKey: string;
  stroke: string;
  gradientId: string;
  name: string;
}

interface TrendChartProps {
  title: string;
  data: TelemetryRecord[];
  dataKey: string;
  stroke: string;
  gradientId: string;
  unit: string;
  name: string;
  hint?: string;
  /** Optional second line (e.g. soil moisture of the other container) */
  series2?: SecondSeries;
}

// Span-aware tick label: include the date once the window crosses ~20h
const makeTickFormatter = (spanMs: number) => (ts: number) =>
  spanMs > 20 * 3600_000
    ? new Date(ts).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : new Date(ts).toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
      });

export default function TrendChart({
  title,
  data,
  dataKey,
  stroke,
  gradientId,
  unit,
  name,
  hint,
  series2,
}: TrendChartProps) {
  // Numeric time axis: gaps between captures render proportionally instead
  // of every record getting equal width
  const chartData = data.map((d) => ({
    ...d,
    __ts: new Date(d.timestamp).getTime(),
  }));
  const spanMs =
    chartData.length > 1
      ? chartData[chartData.length - 1].__ts - chartData[0].__ts
      : 0;
  const tickFormatter = makeTickFormatter(spanMs);

  return (
    <div>
      <h3 className="mb-3 flex items-center gap-2 text-lg font-medium text-gray-800">
        {title}
        {hint && <InfoHint text={hint} />}
      </h3>
      <ResponsiveContainer width="100%" height={250}>
        <AreaChart data={chartData} margin={{ top: 4, right: 16, bottom: 8, left: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity={0.25} />
              <stop offset="100%" stopColor={stroke} stopOpacity={0} />
            </linearGradient>
            {series2 && (
              <linearGradient id={series2.gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={series2.stroke} stopOpacity={0.25} />
                <stop offset="100%" stopColor={series2.stroke} stopOpacity={0} />
              </linearGradient>
            )}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
          <XAxis
            dataKey="__ts"
            type="number"
            scale="time"
            domain={['dataMin', 'dataMax']}
            tickFormatter={tickFormatter}
            minTickGap={56}
            tick={{ fontSize: 12, fill: '#6B7280' }}
            label={{ value: 'Time', position: 'insideBottom', offset: -5 }}
          />
          <YAxis
            tick={{ fontSize: 12, fill: '#6B7280' }}
            label={{ value: unit, angle: -90, position: 'insideLeft' }}
          />
          <Tooltip labelFormatter={(label) => new Date(label as number).toLocaleString()} />
          {series2 && <Legend />}
          <Area
            type="monotone"
            dataKey={dataKey}
            stroke={stroke}
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            name={name}
            connectNulls
            dot={false}
          />
          {series2 && (
            <Area
              type="monotone"
              dataKey={series2.dataKey}
              stroke={series2.stroke}
              strokeWidth={2}
              fill={`url(#${series2.gradientId})`}
              name={series2.name}
              connectNulls
              dot={false}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
