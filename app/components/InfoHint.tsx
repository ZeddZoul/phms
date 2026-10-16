'use client';

import { useState } from 'react';
import { Info } from 'lucide-react';

/** Small "i" icon that reveals an explanation of what a chart or card means. */
export default function InfoHint({ text }: { text: string }) {
  const [open, setOpen] = useState(false);

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        aria-label="What does this mean?"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((o) => !o)}
        className="text-gray-400 transition-colors hover:text-deep-green"
      >
        <Info className="h-4 w-4" />
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute left-1/2 top-full z-50 mt-2 w-64 -translate-x-1/2 rounded-xl border border-gray-200 bg-white p-3 text-xs font-normal leading-relaxed text-gray-600 shadow-lg"
        >
          {text}
        </span>
      )}
    </span>
  );
}
