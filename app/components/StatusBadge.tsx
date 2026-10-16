const statusClasses: Record<string, string> = {
  Healthy: 'text-green-600 bg-green-100',
  Warning: 'text-yellow-600 bg-yellow-100',
  Critical: 'text-red-600 bg-red-100',
};

export default function StatusBadge({ status }: { status?: string }) {
  const classes = (status && statusClasses[status]) || 'text-gray-600 bg-gray-100';
  return (
    <span className={`rounded-full px-3 py-1 text-sm font-medium ${classes}`}>
      {status ?? 'Unknown'}
    </span>
  );
}
