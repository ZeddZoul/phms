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
      'The latest capture at a glance: plant photo, status and diagnosis, a health breakdown with gauges for each container and each plant, per-container readings, and trend charts.',
    href: '/',
  },
  {
    icon: FlaskConical,
    title: 'Simulator',
    description:
      "Stand in for the device: set each container's temperature, humidity and soil (or randomize), pick a maize & beans photo, and send it through the real AI pipeline.",
    href: '/simulator',
  },
  {
    icon: FileBarChart2,
    title: 'Reports',
    description:
      'Two tabs over a selectable window: Insights (averages with A/B splits, status distribution, trends) and Records (paginated capture log with per-container values and a photo viewer), plus CSV export.',
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
      'The ESP32-S3-CAM posts its photo plus per-container readings (temperature, humidity and soil for A and B) to /api/telemetry, authenticated with its device key.',
    href: '/settings',
  },
];

const FAQS: { q: string; a: string }[] = [
  {
    q: 'What do the colors mean?',
    a: 'Green, yellow and red follow the health score: 70 and above is Healthy (green), 40–69 is Warning (yellow), and below 40 is Critical (red). The gauges, status badges and charts all share this language.',
  },
  {
    q: 'How does the AI calculate the /100 scores?',
    a: 'Every capture is analyzed in one PHMS AI analysis that receives the photo, each container\'s own readings (soil, temperature, humidity), and the recent history. The AI inspects each plant against crop-specific checklists (nutrient deficiencies, diseases, pests, water stress) and places it on a fixed 0–100 rubric — see "How the AI scores" above. Plant gauges score what is visible on that plant; container gauges add risk from that container\'s readings, so they can drop first as an early warning.',
  },
  {
    q: 'What are Containers A and B?',
    a: 'Container A is the LEFT container in the camera frame and has the capacitive soil probe; Container B is the RIGHT one with the resistive probe. Each container also has its own temperature/humidity sensor. A number shown without a letter is the average of both containers — look for the small "A x · B y" lines to compare them directly.',
  },
  {
    q: 'Why does a record show no health assessment?',
    a: 'If the AI was busy or unavailable at capture time, the reading is still stored — just without a score. The record is labeled with the reason (for example "AI busy" for a rate limit), and the next capture is analyzed normally.',
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
    a: 'Copy the endpoint URL from Settings → Connect device. The device sends a multipart form-data POST with the photo plus per-container readings — temperatureA/B (°C), humidityA/B (%), soilMoistureA/B (%) — and its device key in the x-device-key header. Older single-sensor payloads (temperature, humidity, soilMoisture) still work.',
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
              An ESP32-S3-CAM photographs your two containers of maize &amp;
              beans and reads each container&apos;s own sensors; the PHMS AI
              assesses every plant; everything lands here.
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

          {/* How the AI scores — full rubric (hidden while searching) */}
          {!q && (
            <div>
              <h2 className="mb-4 text-xl font-semibold text-gray-900">
                How the AI scores /100
              </h2>
              <div className="rounded-2xl bg-white p-6 shadow-sm">
                <p className="text-sm leading-relaxed text-gray-600">
                  Every capture triggers <strong>one PHMS AI analysis</strong>{' '}
                  that receives three inputs: the photo, each container&apos;s
                  own readings (soil moisture, temperature, humidity), and the
                  recent history of readings and scores. The AI checks each
                  plant against crop-specific checklists — nutrient
                  deficiencies, diseases, pests, and water stress — and places
                  it on this fixed rubric:
                </p>

                <div className="mt-4 space-y-2">
                  {[
                    { band: '90–100', label: 'Thriving — vigorous, uniform colour, nothing to fix', cls: 'bg-green-500' },
                    { band: '70–89', label: 'Healthy — minor cosmetic flaws only', cls: 'bg-green-500' },
                    { band: '40–69', label: 'Warning — clear stress or early disease; act within days', cls: 'bg-yellow-500' },
                    { band: '20–39', label: 'Critical — spreading disease or severe stress; act immediately', cls: 'bg-red-500' },
                    { band: '0–19', label: 'Critical — plants collapsing or largely necrotic', cls: 'bg-red-500' },
                  ].map((r) => (
                    <div key={r.band} className="flex items-center gap-3 text-sm">
                      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${r.cls}`} />
                      <span className="w-16 shrink-0 font-bold text-gray-900">
                        {r.band}
                      </span>
                      <span className="text-gray-600">{r.label}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="rounded-xl bg-gray-50 p-4">
                    <div className="font-medium text-gray-900">Plant gauges</div>
                    <p className="mt-1 text-sm leading-relaxed text-gray-600">
                      Score that plant&apos;s <strong>visible condition</strong>{' '}
                      in the photo, judged against its own species&apos;
                      tolerances — beans suffer earlier in heat and dry air
                      than maize, so the same conditions can score them
                      differently.
                    </p>
                  </div>
                  <div className="rounded-xl bg-gray-50 p-4">
                    <div className="font-medium text-gray-900">
                      Container gauges
                    </div>
                    <p className="mt-1 text-sm leading-relaxed text-gray-600">
                      The plants <strong>plus container-level risk</strong>{' '}
                      from that container&apos;s own readings (soil, crowding,
                      drainage). They can drop below the plant gauges — that is
                      the early warning to act before damage becomes visible.
                    </p>
                  </div>
                </div>

                <p className="mt-4 text-sm leading-relaxed text-gray-600">
                  The AI is instructed to report only what it actually sees:
                  when the plants look fine but a reading is alarming, the
                  diagnosis says so explicitly and the low score reflects risk,
                  not invented symptoms. The same explanations appear as{' '}
                  <strong>hover tooltips</strong> on the ⓘ icons next to each
                  chart and the Health Breakdown on the dashboard.
                </p>
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
