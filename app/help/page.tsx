'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  LayoutDashboard,
  FlaskConical,
  FileBarChart2,
  Settings,
  Bell,
  Cpu,
  Search,
  ChevronDown,
  type LucideIcon,
} from 'lucide-react';
import Sidebar from '../components/Sidebar';
import PageHeader from '../components/PageHeader';

interface Topic {
  icon: LucideIcon;
  title: string;
  description: string;
  href?: string;
}

const TOPICS: Topic[] = [
  {
    icon: LayoutDashboard,
    title: 'Dashboard',
    description:
      'The latest capture at a glance: plant photo, health-score gauge, status badge, diagnosis, recommended actions, live environmental readings and trend charts.',
    href: '/',
  },
  {
    icon: FlaskConical,
    title: 'Simulator',
    description:
      'Stand in for the device: set telemetry values (or randomize), pick a maize & beans photo (or use the sample), and send it through the real AI pipeline.',
    href: '/simulator',
  },
  {
    icon: FileBarChart2,
    title: 'Reports',
    description:
      'Aggregated analytics over a selectable window — averages, status distribution, score and environmental trends, the raw records log, and CSV export.',
    href: '/reports',
  },
  {
    icon: Bell,
    title: 'Notifications',
    description:
      'The bell at the top right collects Warning and Critical assessments. A green dot means unread alerts; opening the panel marks them read.',
  },
  {
    icon: Settings,
    title: 'Settings',
    description:
      'Dashboard refresh rate, alert preferences, default reports window, and email alerts — plus the device endpoint, ready to copy.',
    href: '/settings',
  },
  {
    icon: Cpu,
    title: 'Connect device',
    description:
      'The ESP32-S3-CAM posts multipart form-data to /api/telemetry with image, temperature, humidity and soilMoisture fields.',
    href: '/settings',
  },
];

const FAQS: { q: string; a: string }[] = [
  {
    q: 'What do the colors mean?',
    a: 'Green, yellow and red follow the health score: 70 and above is Healthy (green), 40–69 is Warning (yellow), and below 40 is Critical (red). The gauge, status badges and charts all share this language.',
  },
  {
    q: 'Why does a record show no health assessment?',
    a: 'If the AI is temporarily unavailable (rate limit, network, missing key), the reading is still stored — just without a score, status or diagnosis. The next capture is analyzed normally.',
  },
  {
    q: 'How often does the dashboard refresh?',
    a: 'Every 30 seconds by default. You can change it to 15 or 60 seconds in Settings — the change applies immediately, no reload needed.',
  },
  {
    q: 'How do email alerts work?',
    a: 'Register your email in Settings and switch alerts on. When two assessments in a row come back Critical (one alone can be noise), you get an email with the diagnosis and the recommended actions — at most one email per hour.',
  },
  {
    q: 'How do I connect the ESP32?',
    a: 'Copy the endpoint URL from Settings → Connect device. The device sends a multipart form-data POST with four fields: image (JPEG), temperature (°C), humidity (%), and soilMoisture (%).',
  },
];

export default function HelpPage() {
  const [query, setQuery] = useState('');
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const q = query.trim().toLowerCase();
  const topics = useMemo(
    () =>
      q
        ? TOPICS.filter(
            (t) =>
              t.title.toLowerCase().includes(q) ||
              t.description.toLowerCase().includes(q)
          )
        : TOPICS,
    [q]
  );
  const faqs = useMemo(
    () =>
      q
        ? FAQS.filter(
            (f) =>
              f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q)
          )
        : FAQS,
    [q]
  );

  return (
    <div className="flex min-h-screen w-full bg-canvas">
      <Sidebar />

      <main className="min-w-0 flex-1 pt-14 lg:pt-0">
        <PageHeader title="Help" tab="Guide" />

        <div className="mx-auto max-w-4xl space-y-8 p-4 md:p-8">
          {/* Hero with search */}
          <div className="rounded-2xl bg-deep-green px-6 py-10 text-center md:py-12">
            <h2 className="text-2xl font-bold text-white md:text-3xl">
              How can we help?
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-gray-200">
              An ESP32-S3-CAM photographs your maize &amp; beans and reads the
              sensors; Gemini AI assesses their health; everything lands here.
            </p>
            <div className="relative mx-auto mt-6 max-w-md">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search topics and FAQs…"
                className="w-full rounded-full border-0 bg-white py-3 pl-11 pr-4 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
          </div>

          {/* Topic cards */}
          {topics.length > 0 && (
            <div>
              <h2 className="mb-4 text-xl font-semibold text-gray-900">
                Explore the app
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {topics.map(({ icon: Icon, title, description, href }) => {
                  const card = (
                    <div className="h-full rounded-2xl bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
                      <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-deep-green/10 text-deep-green">
                        <Icon className="h-5 w-5" />
                      </span>
                      <h3 className="mb-1.5 font-semibold text-gray-900">
                        {title}
                      </h3>
                      <p className="text-sm leading-relaxed text-gray-600">
                        {description}
                      </p>
                    </div>
                  );
                  return href ? (
                    <Link key={title} href={href} className="block">
                      {card}
                    </Link>
                  ) : (
                    <div key={title}>{card}</div>
                  );
                })}
              </div>
            </div>
          )}

          {/* FAQ accordion */}
          {faqs.length > 0 && (
            <div>
              <h2 className="mb-4 text-xl font-semibold text-gray-900">
                Frequently asked questions
              </h2>
              <div className="divide-y divide-gray-100 rounded-2xl bg-white shadow-sm">
                {faqs.map((f, idx) => {
                  const open = openFaq === idx;
                  return (
                    <div key={f.q}>
                      <button
                        type="button"
                        onClick={() => setOpenFaq(open ? null : idx)}
                        aria-expanded={open}
                        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                      >
                        <span className="font-medium text-gray-900">{f.q}</span>
                        <ChevronDown
                          className={`h-4 w-4 shrink-0 text-gray-500 transition-transform ${
                            open ? 'rotate-180' : ''
                          }`}
                        />
                      </button>
                      {open && (
                        <p className="px-5 pb-4 text-sm leading-relaxed text-gray-600">
                          {f.a}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {topics.length === 0 && faqs.length === 0 && (
            <div className="rounded-2xl bg-white p-10 text-center text-gray-500 shadow-sm">
              No results for &ldquo;{query}&rdquo; — try a different term.
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
