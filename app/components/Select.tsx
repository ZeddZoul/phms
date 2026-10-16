'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

export interface SelectOption<T extends string | number> {
  value: T;
  label: string;
}

/**
 * Site-wide custom dropdown, replacing native <select> controls so the
 * options panel matches the design system (white popover, deep-green
 * selected state, check mark).
 */
export default function Select<T extends string | number>({
  value,
  options,
  onChange,
  disabled = false,
  ariaLabel,
}: {
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open]);

  const selected = options.find((o) => o.value === value);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
        className="flex min-w-44 items-center justify-between gap-3 rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm font-medium text-gray-900 transition-colors hover:border-deep-green focus:outline-none focus:ring-2 focus:ring-deep-green/30 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className="truncate">{selected?.label ?? '—'}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-gray-500 transition-transform ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute right-0 z-50 mt-2 w-full min-w-44 overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-lg"
        >
          {options.map((o) => {
            const isSelected = o.value === value;
            return (
              <li key={String(o.value)} role="option" aria-selected={isSelected}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left text-sm transition-colors hover:bg-canvas ${
                    isSelected ? 'font-medium text-deep-green' : 'text-gray-700'
                  }`}
                >
                  <span className="truncate">{o.label}</span>
                  {isSelected && <Check className="h-4 w-4 shrink-0" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
