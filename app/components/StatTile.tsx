import type { LucideIcon } from 'lucide-react';

interface StatTileProps {
  icon: LucideIcon;
  iconClassName: string;
  label: string;
  value: string;
  compact?: boolean;
}

export default function StatTile({
  icon: Icon,
  iconClassName,
  label,
  value,
  compact = false,
}: StatTileProps) {
  return (
    <div className={`flex items-center ${compact ? 'gap-3' : 'gap-4'}`}>
      <span
        className={`flex ${compact ? 'h-10 w-10' : 'h-12 w-12'} shrink-0 items-center justify-center rounded-xl ${iconClassName}`}
      >
        <Icon className={compact ? 'h-5 w-5' : 'h-6 w-6'} />
      </span>
      <div className="min-w-0">
        <div className={`${compact ? 'text-xs' : 'text-sm'} text-gray-500`}>{label}</div>
        <div className={`${compact ? 'text-lg' : 'text-2xl'} font-bold text-gray-900`}>
          {value}
        </div>
      </div>
    </div>
  );
}
