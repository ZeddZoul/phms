'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  FlaskConical,
  FileBarChart2,
  Settings,
  HelpCircle,
  Leaf,
  LogOut,
  Menu,
  X,
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

function NavLinks({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  const linkClass = (active: boolean) =>
    active
      ? 'flex items-center gap-3 rounded-lg bg-accent px-3 py-2.5 font-medium text-sidebar'
      : 'flex items-center gap-3 rounded-lg px-3 py-2.5 text-gray-300 transition-colors hover:bg-white/10';

  return (
    <>
      {mainNav.map(({ label, href, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          onClick={onNavigate}
          className={linkClass(pathname === href)}
        >
          <Icon className="h-5 w-5" />
          {label}
        </Link>
      ))}
      <div className="!my-4 border-t border-white/10" />
      {secondaryNav.map(({ label, href, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          onClick={onNavigate}
          className={linkClass(pathname === href)}
        >
          <Icon className="h-5 w-5" />
          {label}
        </Link>
      ))}
    </>
  );
}

function UserBlock() {
  const router = useRouter();

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      router.push('/login');
      router.refresh();
    }
  };

  return (
    <div className="flex items-center gap-3 border-t border-white/10 px-5 py-5">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-deep-green">
        <Leaf className="h-5 w-5 text-accent" />
      </span>
      <div className="min-w-0 flex-1 leading-tight">
        <div className="font-medium">Plant Owner</div>
        <div className="text-xs text-gray-400">IoT monitoring</div>
      </div>
      <button
        type="button"
        onClick={logout}
        aria-label="Log out"
        title="Log out"
        className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
      >
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile top bar */}
      <div className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between bg-sidebar px-4 lg:hidden">
        <span className="text-xl font-bold tracking-tight text-white">PHMS</span>
        <button
          type="button"
          aria-label="Open navigation"
          onClick={() => setMobileOpen(true)}
          className="rounded-lg p-2 text-white transition-colors hover:bg-white/10"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
            className="absolute inset-0 bg-black/50"
          />
          <div className="absolute inset-y-0 left-0 flex w-72 flex-col bg-sidebar text-white shadow-xl">
            <div className="flex items-center justify-between px-6 py-5">
              <span className="text-2xl font-bold tracking-tight">PHMS</span>
              <button
                type="button"
                aria-label="Close navigation"
                onClick={() => setMobileOpen(false)}
                className="rounded-lg p-2 text-gray-300 transition-colors hover:bg-white/10"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 space-y-1 overflow-y-auto px-3">
              <NavLinks
                pathname={pathname}
                onNavigate={() => setMobileOpen(false)}
              />
            </nav>
            <UserBlock />
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col bg-sidebar text-white">
        <div className="px-6 py-7">
          <span className="text-2xl font-bold tracking-tight">PHMS</span>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          <NavLinks pathname={pathname} />
        </nav>
        <UserBlock />
      </aside>
    </>
  );
}
