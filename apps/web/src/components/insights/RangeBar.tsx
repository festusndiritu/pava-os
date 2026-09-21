'use client';

import { useMemo, useState } from 'react';
import { CalendarRange } from 'lucide-react';
import type { DateRange } from '../../lib/analytics-api';

export type PresetKey = 'today' | '7d' | '30d' | 'month' | 'custom';

const PRESETS: { key: PresetKey; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: '7d', label: '7 days' },
  { key: '30d', label: '30 days' },
  { key: 'month', label: 'This month' },
  { key: 'custom', label: 'Custom' },
];

/**
 * Local calendar day as YYYY-MM-DD. Deliberately not toISOString(), which
 * shifts to UTC and hands the backend yesterday's date for anyone east of
 * Greenwich — Nairobi is UTC+3, so every "Today" before 3am would have been
 * wrong.
 */
export function isoDay(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function rangeForPreset(key: Exclude<PresetKey, 'custom'>, now = new Date()): DateRange {
  const today = isoDay(now);
  if (key === 'today') return { from: today, to: today };
  if (key === 'month') return { from: isoDay(new Date(now.getFullYear(), now.getMonth(), 1)), to: today };
  const days = key === '7d' ? 6 : 29;
  const start = new Date(now);
  start.setDate(start.getDate() - days);
  return { from: isoDay(start), to: today };
}

export function useDateRange(initial: Exclude<PresetKey, 'custom'> = '30d') {
  const [preset, setPresetState] = useState<PresetKey>(initial);
  const [range, setRange] = useState<DateRange>(() => rangeForPreset(initial));

  function setPreset(key: PresetKey) {
    setPresetState(key);
    if (key !== 'custom') setRange(rangeForPreset(key));
  }

  function setBound(which: 'from' | 'to', value: string) {
    if (!value) return;
    setPresetState('custom');
    setRange((current) => {
      const next = { ...current, [which]: value };
      // Keep the range the right way round rather than letting the server
      // reject it — picking a "from" past the current "to" almost always
      // means the person is starting a new range, not asking for an error.
      if (next.from > next.to) return which === 'from' ? { from: value, to: value } : { from: value, to: value };
      return next;
    });
  }

  return { range, preset, setPreset, setBound };
}

export function RangeBar({
  range,
  preset,
  onPreset,
  onBound,
  trailing,
}: {
  range: DateRange;
  preset: PresetKey;
  onPreset: (key: PresetKey) => void;
  onBound: (which: 'from' | 'to', value: string) => void;
  trailing?: React.ReactNode;
}) {
  const label = useMemo(() => {
    const fmt = (iso: string) => new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' }).format(new Date(`${iso}T00:00:00`));
    return range.from === range.to ? fmt(range.from) : `${fmt(range.from)} – ${fmt(range.to)}`;
  }, [range]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((p) => {
          const active = preset === p.key;
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => onPreset(p.key)}
              className="rounded-md border px-3 py-1.5 text-xs font-medium transition-colors"
              style={{
                borderColor: active ? 'var(--color-accent)' : 'var(--color-border)',
                color: active ? 'var(--color-accent)' : 'var(--color-ink-600)',
                backgroundColor: active ? 'var(--color-accent-soft)' : 'var(--color-surface)',
              }}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {preset === 'custom' ? (
        <div className="flex items-center gap-1.5">
          <input
            type="date"
            value={range.from}
            max={range.to}
            onChange={(e) => onBound('from', e.target.value)}
            className="rounded-md border px-2.5 py-1.5 text-xs outline-none"
            style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-ink-900)' }}
          />
          <span className="text-xs" style={{ color: 'var(--color-ink-500)' }}>
            to
          </span>
          <input
            type="date"
            value={range.to}
            min={range.from}
            onChange={(e) => onBound('to', e.target.value)}
            className="rounded-md border px-2.5 py-1.5 text-xs outline-none"
            style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-ink-900)' }}
          />
        </div>
      ) : (
        <span className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--color-ink-500)' }}>
          <CalendarRange size={13} strokeWidth={2} />
          {label}
        </span>
      )}

      {trailing}
    </div>
  );
}
