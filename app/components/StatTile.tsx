import type { LucideIcon } from 'lucide-react';

interface StatTileProps {
  icon: LucideIcon;
  iconClassName: string;
  label: string;
  value: string;
}

export default function StatTile({ icon: Icon, iconClassName, label, value }: StatTileProps) {
  return (
    <div className="flex items-center gap-4">
      <span className={`flex h-12 w-12 items-center justify-center rounded-xl ${iconClassName}`}>
        <Icon className="h-6 w-6" />
      </span>
      <div>
        <div className="text-sm text-gray-500">{label}</div>
        <div className="text-2xl font-bold text-gray-900">{value}</div>
      </div>
    </div>
  );
}
