import NotificationsBell from './NotificationsBell';

interface PageHeaderProps {
  title: string;
  /** Single static tab label (pages without tabbed content) */
  tab?: string;
  /** Interactive tabs — when provided, overrides `tab` */
  tabs?: string[];
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

export default function PageHeader({
  title,
  tab,
  tabs,
  activeTab,
  onTabChange,
}: PageHeaderProps) {
  return (
    <header className="border-b border-gray-200 bg-white px-4 md:px-8">
      <div className="flex items-start justify-between gap-4 pt-6">
        <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">{title}</h1>
        <NotificationsBell />
      </div>
      <nav className="mt-4 flex gap-6 text-sm font-medium">
        {tabs ? (
          tabs.map((t) => {
            const active = t === activeTab;
            return (
              <button
                key={t}
                type="button"
                onClick={() => onTabChange?.(t)}
                className={
                  active
                    ? 'border-b-2 border-deep-green pb-3 text-deep-green'
                    : 'border-b-2 border-transparent pb-3 text-gray-500 transition-colors hover:text-gray-800'
                }
              >
                {t}
              </button>
            );
          })
        ) : (
          <span className="border-b-2 border-deep-green pb-3 text-deep-green">
            {tab}
          </span>
        )}
      </nav>
    </header>
  );
}
