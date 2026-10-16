'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  FlaskConical,
  FileBarChart2,
  Settings,
  HelpCircle,
  Leaf,
} from 'lucide-react';

const mainNav = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { label: 'Simulator', href: '/simulator', icon: FlaskConical },
  { label: 'Reports', href: '/reports', icon: FileBarChart2 },
];

const secondaryNav = [
  { label: 'Settings', href: '/settings', icon: Settings },
  { label: 'Help', href: '/help', icon: HelpCircle },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:flex w-64 shrink-0 flex-col bg-sidebar text-white">
      <div className="px-6 py-7">
        <span className="text-2xl font-bold tracking-tight">PHMS</span>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {mainNav.map(({ label, href, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={
                active
                  ? 'flex items-center gap-3 rounded-lg bg-accent px-3 py-2.5 font-medium text-sidebar'
                  : 'flex items-center gap-3 rounded-lg px-3 py-2.5 text-gray-300 transition-colors hover:bg-white/10'
              }
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          );
        })}
        <div className="!my-4 border-t border-white/10" />
        {secondaryNav.map(({ label, href, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={
                active
                  ? 'flex items-center gap-3 rounded-lg bg-accent px-3 py-2.5 font-medium text-sidebar'
                  : 'flex items-center gap-3 rounded-lg px-3 py-2.5 text-gray-300 transition-colors hover:bg-white/10'
              }
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="flex items-center gap-3 border-t border-white/10 px-5 py-5">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-deep-green">
          <Leaf className="h-5 w-5 text-accent" />
        </span>
        <div className="leading-tight">
          <div className="font-medium">Plant Owner</div>
          <div className="text-xs text-gray-400">IoT monitoring</div>
        </div>
      </div>
    </aside>
  );
}
