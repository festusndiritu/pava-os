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

export function TrendPill({ trend, comparison, className = 'mt-2' }: { trend: Trend; comparison: string; className?: string }) {
  const positive = trend.direction === 'up';
  const flat = trend.direction === 'flat';
  const fg = flat ? 'var(--color-ink-600)' : positive ? 'var(--color-status-ok)' : 'var(--color-status-bad)';
  const bg = flat ? 'var(--color-bg)' : positive ? 'var(--color-status-okSoft)' : 'var(--color-status-badSoft)';
  const Icon = flat ? Minus : positive ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`${className} inline-flex max-w-full items-center gap-1 text-xs`} style={{ color: 'var(--color-ink-600)' }}>
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
  footer,
  href,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: LucideIcon;
  tone?: Tone;
  trend?: Trend | null;
  trendComparison?: string;
  /** Extra content under the figures, e.g. a sparkline. */
  footer?: React.ReactNode;
  /** Makes the whole card a link. Omit when the user cannot open the destination. */
  href?: string;
}) {
  const colors = TONE[tone];
  const card = (
    <div
      className="flex h-full min-w-0 flex-col rounded-lg border p-4 transition-shadow"
      style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-card)' }}
    >
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded" style={{ backgroundColor: colors.soft, color: colors.fg }}>
          <Icon size={13} strokeWidth={2} />
        </span>
        <p className="truncate text-[11px] font-semibold uppercase" style={{ color: 'var(--color-ink-600)', letterSpacing: '0.06em' }}>
          {label}
        </p>
        {href && <ArrowUpRight size={13} strokeWidth={1.8} className="ml-auto shrink-0 opacity-30 transition-opacity group-hover:opacity-80" />}
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
      {footer && <div className="mt-3">{footer}</div>}
    </div>
  );

  if (!href) return card;

  return (
    <Link href={href} aria-label={`${label}: ${value}`} className="group block min-w-0 rounded-lg hover:[&>div]:shadow-md">
      {card}
    </Link>
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
  href,
}: {
  marker?: React.ReactNode;
  title: React.ReactNode;
  meta?: React.ReactNode;
  value: React.ReactNode;
  valueTone?: string;
  action?: React.ReactNode;
  /** Makes the whole row a link. */
  href?: string;
}) {
  const className = `flex items-center gap-3 border-b py-2.5 last:border-b-0 last:pb-0${
    href ? ' -mx-2 rounded-md px-2 transition-colors hover:bg-[var(--color-bg)]' : ''
  }`;

  const content = (
    <>
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
    </>
  );

  if (href) {
    return (
      <Link href={href} className={className} style={{ borderColor: 'var(--color-border)' }}>
        {content}
      </Link>
    );
  }

  return (
    <div className={className} style={{ borderColor: 'var(--color-border)' }}>
      {content}
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

/** Placeholder block. Pulses, unless the user has asked for reduced motion. */
export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-lg motion-reduce:animate-none ${className}`}
      style={{ backgroundColor: 'var(--color-border)' }}
    />
  );
}

/** Skeleton shaped like a SectionCard, so a loading section keeps its footprint. */
export function SectionSkeleton({ heightClass = 'h-64' }: { heightClass?: string }) {
  return (
    <div
      aria-hidden="true"
      className="flex flex-col gap-4 rounded-lg border p-4 sm:p-5"
      style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-card)' }}
    >
      <div className="flex items-center gap-2.5">
        <Skeleton className="h-7 w-7" />
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-2.5 w-40" />
        </div>
      </div>
      <Skeleton className={`${heightClass} w-full`} />
    </div>
  );
}

export function EmptyState({ icon: Icon, line }: { icon: LucideIcon; line: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5 py-8 text-center">
      <Icon size={20} strokeWidth={1.5} style={{ color: 'var(--color-ink-400)' }} />
      <p className="text-sm" style={{ color: 'var(--color-ink-600)' }}>
        {line}
      </p>
    </div>
  );
}
