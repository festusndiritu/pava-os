'use client';

import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { ArrowDownRight, ArrowRight, ArrowUpRight, Minus } from 'lucide-react';
import type { Trend } from './dashboard-derive';

export type Tone = 'neutral' | 'ok' | 'warn' | 'bad';

const TONE: Record<Tone, { fg: string; soft: string }> = {
  neutral: { fg: 'var(--color-accent)', soft: 'var(--color-accent-soft)' },
  ok: { fg: 'var(--color-status-ok)', soft: 'var(--color-status-okSoft)' },
  warn: { fg: 'var(--color-status-warn)', soft: 'var(--color-status-warnSoft)' },
  bad: { fg: 'var(--color-status-bad)', soft: 'var(--color-status-badSoft)' },
};

export function toneColors(tone: Tone) {
  return TONE[tone];
}

/** Bordered surface panel used by every dashboard block, chart included. */
export function SectionCard({
  title,
  description,
  icon: Icon,
  iconTone = 'neutral',
  action,
  children,
  className = '',
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  iconTone?: Tone;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const tone = TONE[iconTone];
  return (
    <section
      className={`flex min-w-0 flex-col rounded-lg border p-4 sm:p-5 ${className}`}
      style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-card)' }}
    >
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          {Icon && (
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md" style={{ backgroundColor: tone.soft, color: tone.fg }}>
              <Icon size={15} strokeWidth={2} />
            </span>
          )}
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold" style={{ color: 'var(--color-ink-900)' }}>
              {title}
            </h2>
            {description && (
              <p className="mt-0.5 text-xs leading-snug" style={{ color: 'var(--color-ink-600)' }}>
                {description}
              </p>
            )}
          </div>
        </div>
        {action && <div className="flex shrink-0 items-center gap-1">{action}</div>}
      </header>
      <div className="min-w-0 flex-1">{children}</div>
    </section>
  );
}

/** Icon-only link with a native tooltip and a touch-sized hit area. */
export function IconAction({ href, label, icon: Icon }: { href: string; label: string; icon: LucideIcon }) {
  return (
    <Link
      href={href}
      title={label}
      aria-label={label}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border transition-colors"
      style={{ borderColor: 'var(--color-border)', color: 'var(--color-ink-600)' }}
    >
      <Icon size={15} strokeWidth={2} />
    </Link>
  );
}

/** Text link used at the foot of a section. */
export function SectionLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="mt-4 inline-flex items-center gap-1 text-xs font-medium" style={{ color: 'var(--color-accent)' }}>
      {label} <ArrowRight size={12} strokeWidth={2} />
    </Link>
  );
}

function TrendPill({ trend, comparison }: { trend: Trend; comparison: string }) {
  const positive = trend.direction === 'up';
  const flat = trend.direction === 'flat';
  const fg = flat ? 'var(--color-ink-600)' : positive ? 'var(--color-status-ok)' : 'var(--color-status-bad)';
  const bg = flat ? 'var(--color-bg)' : positive ? 'var(--color-status-okSoft)' : 'var(--color-status-badSoft)';
  const Icon = flat ? Minus : positive ? ArrowUpRight : ArrowDownRight;
  return (
    <span className="mt-2 inline-flex max-w-full items-center gap-1 text-xs" style={{ color: 'var(--color-ink-600)' }}>
      <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 font-medium" style={{ backgroundColor: bg, color: fg }}>
        <Icon size={12} strokeWidth={2.2} />
        {flat ? 'level' : `${trend.pct}%`}
      </span>
      <span className="truncate">{comparison}</span>
    </span>
  );
}

export function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  tone = 'neutral',
  trend,
  trendComparison,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: LucideIcon;
  tone?: Tone;
  trend?: Trend | null;
  trendComparison?: string;
}) {
  const colors = TONE[tone];
  return (
    <div
      className="flex min-w-0 flex-col rounded-lg border p-4"
      style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-card)' }}
    >
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded" style={{ backgroundColor: colors.soft, color: colors.fg }}>
          <Icon size={13} strokeWidth={2} />
        </span>
        <p className="truncate text-[11px] font-semibold uppercase" style={{ color: 'var(--color-ink-600)', letterSpacing: '0.06em' }}>
          {label}
        </p>
      </div>
      <p className="data-num mt-2.5 truncate text-xl font-semibold sm:text-2xl" style={{ color: 'var(--color-ink-900)' }}>
        {value}
      </p>
      {sub && (
        <p className="mt-0.5 truncate text-xs" style={{ color: 'var(--color-ink-600)' }}>
          {sub}
        </p>
      )}
      {trend && trendComparison && <TrendPill trend={trend} comparison={trendComparison} />}
    </div>
  );
}

/** Compact list row: leading marker, flexible body, right-aligned value, optional action. */
export function ListRow({
  marker,
  title,
  meta,
  value,
  valueTone,
  action,
}: {
  marker?: React.ReactNode;
  title: React.ReactNode;
  meta?: React.ReactNode;
  value: React.ReactNode;
  valueTone?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 border-b py-2.5 last:border-b-0 last:pb-0" style={{ borderColor: 'var(--color-border)' }}>
      {marker}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm" style={{ color: 'var(--color-ink-900)' }}>
          {title}
        </p>
        {meta && (
          <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs" style={{ color: 'var(--color-ink-600)' }}>
            {meta}
          </p>
        )}
      </div>
      <span className="data-num shrink-0 text-sm font-medium" style={{ color: valueTone ?? 'var(--color-ink-900)' }}>
        {value}
      </span>
      {action}
    </div>
  );
}

export function Badge({ label, tone }: { label: string; tone: Tone }) {
  const colors = TONE[tone];
  return (
    <span className="rounded px-1.5 py-0.5 text-[11px] font-medium" style={{ backgroundColor: colors.soft, color: colors.fg }}>
      {label}
    </span>
  );
}