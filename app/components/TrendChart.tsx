'use client';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import InfoHint from './InfoHint';
import type { TelemetryRecord } from '@/types/telemetry';

interface TrendChartProps {
  title: string;
  data: TelemetryRecord[];
  dataKey: 'temperature' | 'humidity' | 'soilMoisture';
  stroke: string;
  gradientId: string;
  unit: string;
  name: string;
  hint?: string;
}

const formatTimestamp = (timestamp: string) =>
  new Date(timestamp).toLocaleTimeString('en-US', {
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
}: TrendChartProps) {
  return (
    <div>
      <h3 className="mb-3 flex items-center gap-2 text-lg font-medium text-gray-800">
        {title}
        {hint && <InfoHint text={hint} />}
      </h3>
      <ResponsiveContainer width="100%" height={250}>
        <AreaChart data={data} margin={{ top: 4, right: 16, bottom: 8, left: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity={0.25} />
              <stop offset="100%" stopColor={stroke} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
          <XAxis
            dataKey="timestamp"
            tickFormatter={formatTimestamp}
            tick={{ fontSize: 12, fill: '#6B7280' }}
            label={{ value: 'Time', position: 'insideBottom', offset: -5 }}
          />
          <YAxis
            tick={{ fontSize: 12, fill: '#6B7280' }}
            label={{ value: unit, angle: -90, position: 'insideLeft' }}
          />
          <Tooltip labelFormatter={(label) => new Date(label as string).toLocaleString()} />
          <Area
            type="monotone"
            dataKey={dataKey}
            stroke={stroke}
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            name={name}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
