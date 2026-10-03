'use client';

import Link from 'next/link';
import { Area, AreaChart, ResponsiveContainer, Tooltip, YAxis } from 'recharts';
import type { LucideIcon } from 'lucide-react';
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  FileText,
  PackagePlus,
  PackageSearch,
  Receipt,
  ShoppingCart,
  Wallet,
} from 'lucide-react';
import type { ModuleKey } from '../../lib/constants';
import type { DashboardSummary } from '../../lib/dashboard-api';
import {
  attentionItems,
  dayOverDay,
  firstName,
  fmtDate,
  greetingFor,
  money,
  type AttentionItem,
} from './dashboard-derive';
import { toneColors } from './DashboardPrimitives';

const ICONS = {
  stock: PackageSearch,
  credit: Wallet,
  invoice: Receipt,
} as const;

const QUICK_ACTIONS: {
  module: ModuleKey;
  href: string;
  label: string;
  icon: LucideIcon;
  primary?: boolean;
}[] = [
  { module: 'POS', href: '/pos', label: 'New sale', icon: ShoppingCart, primary: true },
  { module: 'QUOTES', href: '/quotes', label: 'New quote', icon: FileText },
  { module: 'INVENTORY', href: '/inventory', label: 'Receive stock', icon: PackagePlus },
];

function QuickAction({
  href,
  label,
  icon: Icon,
  primary,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className="flex min-h-10 items-center gap-1.5 rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors hover:brightness-95"
      style={
        primary
          ? {
              backgroundColor: 'var(--color-accent)',
              borderColor: 'var(--color-accent)',
              color: '#fff',
            }
          : {
              backgroundColor: 'var(--color-surface)',
              borderColor: 'var(--color-border)',
              color: 'var(--color-ink-900)',
            }
      }
    >
      <Icon size={15} strokeWidth={2} />
      {label}
    </Link>
  );
}

function AttentionChip({
  item,
  linked,
}: {
  item: AttentionItem;
  linked: boolean;
}) {
  const Icon = ICONS[item.icon];
  const colors = toneColors(item.tone === 'bad' ? 'bad' : 'warn');

  const body = (
    <span
      className="group flex min-h-10 items-center gap-2.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors"
      style={{
        borderColor: 'var(--color-border)',
        backgroundColor: 'var(--color-surface)',
        color: 'var(--color-ink-900)',
        borderLeft: `3px solid ${colors.fg}`,
      }}
    >
      <span
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md"
        style={{ backgroundColor: colors.soft, color: colors.fg }}
      >
        <Icon size={13} strokeWidth={2} />
      </span>

      <span className="min-w-0 truncate">{item.label}</span>

      {linked && (
        <ArrowUpRight
          size={13}
          strokeWidth={1.8}
          className="ml-auto shrink-0 opacity-40 transition-opacity group-hover:opacity-80"
        />
      )}
    </span>
  );

  if (!linked) return body;

  return (
    <Link
      href={item.href}
      title={`Open ${item.href.replace('/', '')}`}
      className="block"
    >
      {body}
    </Link>
  );
}

/** Compact 7-day paid-sales trend for the header. Hidden until there is something to draw. */
function WeekSparkline({
  chart,
  weekTotal,
}: {
  chart: NonNullable<DashboardSummary['chart']>;
  weekTotal?: number;
}) {
  const points = chart.slice(-7);

  if (points.length < 2 || !points.some((p) => p.total > 0)) return null;

  return (
    <div
      className="flex w-full flex-col gap-1 rounded-lg border px-3 pb-1 pt-2.5 sm:w-60"
      style={{
        borderColor: 'var(--color-border)',
        backgroundColor: 'var(--color-surface)',
      }}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span
          className="text-[11px] font-semibold uppercase tracking-[0.06em]"
          style={{ color: 'var(--color-ink-600)' }}
        >
          Last 7 days
        </span>
        {weekTotal != null && (
          <span
            className="data-num text-xs font-medium"
            style={{ color: 'var(--color-ink-900)' }}
          >
            {money(weekTotal)}
          </span>
        )}
      </div>

      <div className="h-12 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={points} margin={{ top: 4, right: 2, bottom: 2, left: 2 }}>
            <defs>
              <linearGradient id="overview-spark-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" style={{ stopColor: 'var(--color-accent)', stopOpacity: 0.3 }} />
                <stop offset="100%" style={{ stopColor: 'var(--color-accent)', stopOpacity: 0 }} />
              </linearGradient>
            </defs>
            <YAxis hide domain={[0, 'dataMax']} />
            <Tooltip
              formatter={(v: number) => money(v)}
              labelFormatter={fmtDate}
              contentStyle={{
                fontSize: 11,
                borderRadius: 6,
                padding: '4px 8px',
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-surface)',
                color: 'var(--color-ink-900)',
              }}
              cursor={{ stroke: 'var(--color-border)' }}
            />
            <Area
              type="monotone"
              dataKey="total"
              stroke="var(--color-accent)"
              strokeWidth={1.75}
              fill="url(#overview-spark-fill)"
              dot={false}
              activeDot={{ r: 3 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/**
 * Greeting, one sentence of sales context, quick actions, and the
 * "needs attention" strip. Every line here is conditional: if the underlying
 * data is missing — because of permissions or because there is simply nothing
 * yet — the line is dropped rather than filled in.
 */
export function OverviewHeader({
  userName,
  data,
  hasPermission,
}: {
  userName: string;
  data: DashboardSummary | null;
  hasPermission: (module: ModuleKey) => boolean;
}) {
  const comparison = dayOverDay(data?.chart);
  const items = attentionItems(data);
  const actions = QUICK_ACTIONS.filter((a) => hasPermission(a.module));

  const dateLabel = new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date());

  let salesLine: string | null = null;

  if (data?.sales) {
    if (comparison?.trend && comparison.trend.direction !== 'flat') {
      const word =
        comparison.trend.direction === 'up' ? 'ahead of' : 'behind';

      salesLine = `Today's sales are ${comparison.trend.pct}% ${word} yesterday.`;
    } else if (comparison?.trend) {
      salesLine = "Today's sales are level with yesterday.";
    } else if (data.sales.today.total > 0) {
      salesLine = `${money(data.sales.today.total)} taken so far today.`;
    } else {
      salesLine = 'No sales recorded yet today.';
    }
  }

  return (
    <div
      className="flex flex-col gap-5 rounded-xl border p-5 sm:p-6"
      style={{
        borderColor: 'var(--color-border)',
        backgroundColor: 'var(--color-surface)',
        backgroundImage:
          'radial-gradient(ellipse 60% 100% at 100% 0%, var(--color-accent-soft), transparent 70%)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex items-center gap-2">
            <div
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: 'var(--color-accent)' }}
            />
            <span
              className="text-[11px] font-semibold uppercase tracking-[0.08em]"
              style={{ color: 'var(--color-ink-600)' }}
            >
              Overview · {dateLabel}
            </span>
          </div>

          <h1
            className="mt-1 text-2xl font-semibold tracking-tight sm:text-[28px]"
            style={{ color: 'var(--color-ink-900)' }}
          >
            {greetingFor()}, {firstName(userName)}.
          </h1>

          {salesLine && (
            <p
              className="mt-1 text-sm"
              style={{ color: 'var(--color-ink-600)' }}
            >
              {salesLine}
            </p>
          )}
        </div>

        {(actions.length > 0 || (data?.sales && data.chart)) && (
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:items-end">
            {data?.sales && data.chart && (
              <WeekSparkline chart={data.chart} weekTotal={data.sales.week.total} />
            )}

            {actions.length > 0 && (
              <div className="flex flex-wrap gap-2 sm:justify-end">
                {actions.map((a) => (
                  <QuickAction key={a.href} {...a} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {data && (
        <div
          className="rounded-lg border p-3 sm:p-4"
          style={{
            borderColor: 'var(--color-border)',
            backgroundColor: 'var(--color-bg)',
          }}
        >
          <div className="mb-3 flex items-center gap-2">
            <span
              className="flex h-6 w-6 items-center justify-center rounded-md"
              style={
                items.length > 0
                  ? {
                      backgroundColor: 'var(--color-status-warnSoft)',
                      color: 'var(--color-status-warn)',
                    }
                  : {
                      backgroundColor: 'var(--color-status-okSoft)',
                      color: 'var(--color-status-ok)',
                    }
              }
            >
              {items.length > 0 ? (
                <AlertTriangle size={13} strokeWidth={2} />
              ) : (
                <CheckCircle2 size={13} strokeWidth={2} />
              )}
            </span>

            <div>
              <p
                className="text-xs font-semibold"
                style={{ color: 'var(--color-ink-900)' }}
              >
                {items.length > 0 ? 'Needs attention' : 'All clear'}
              </p>

              <p
                className="text-[11px]"
                style={{ color: 'var(--color-ink-600)' }}
              >
                {items.length > 0
                  ? `${items.length} item${items.length === 1 ? '' : 's'} to review`
                  : 'Nothing is flagged right now'}
              </p>
            </div>
          </div>

          {items.length > 0 && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((item) => (
                <AttentionChip
                  key={item.id}
                  item={item}
                  linked={hasPermission(item.module)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}