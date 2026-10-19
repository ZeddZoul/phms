'use client';

import {
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
  ResponsiveContainer,
} from 'recharts';

// Ring color follows the status thresholds (>=70 Healthy, 40-69 Warning, <40 Critical)
function gaugeColor(score: number): string {
  if (score >= 70) return '#16A34A'; // green — Healthy
  if (score >= 40) return '#EAB308'; // yellow — Warning
  return '#DC2626'; // red — Critical
}

export default function HealthGauge({
  score,
  size = 160,
}: {
  score: number;
  size?: number;
}) {
  const large = size >= 140;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart
          cx="50%"
          cy="50%"
          innerRadius="78%"
          outerRadius="100%"
          barSize={large ? 10 : 7}
          data={[{ name: 'score', value: score }]}
          startAngle={90}
          endAngle={-270}
        >
          <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
          <RadialBar
            dataKey="value"
            cornerRadius={10}
            fill={gaugeColor(score)}
            background={{ fill: '#E8ECE9' }}
          />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`${large ? 'text-3xl' : 'text-xl'} font-bold text-gray-900`}>
          {score}
        </span>
        <span className={`${large ? 'text-xs' : 'text-[10px]'} text-gray-500`}>
          / 100
        </span>
      </div>
    </div>
  );
}
