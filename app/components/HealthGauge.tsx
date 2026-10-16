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

export default function HealthGauge({ score }: { score: number }) {
  return (
    <div className="relative h-40 w-40">
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart
          cx="50%"
          cy="50%"
          innerRadius="78%"
          outerRadius="100%"
          barSize={10}
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
        <span className="text-3xl font-bold text-gray-900">{score}</span>
        <span className="text-xs text-gray-500">/ 100</span>
      </div>
    </div>
  );
}
