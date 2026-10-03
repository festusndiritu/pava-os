import type { ModuleKey } from '../../lib/constants';
import type { DashboardSummary } from '../../lib/dashboard-api';

import { money as moneyLabel } from '../../lib/format';

export type ChartPoint = { date: string; total: number };

export { money } from '../../lib/format';

/**
 * Accepts both full timestamps and the API's date-only chart keys. A bare
 * "2026-10-03" is built as a local calendar date — `new Date('2026-10-03')`
 * is UTC midnight and shows the previous day west of Greenwich.
 */
export function fmtDate(iso: string) {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  const date = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : new Date(iso);

  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
  }).format(date);
}

export function plural(n: number, one: string, many = `${one}s`) {
  return n === 1 ? one : many;
}

export function greetingFor(date: Date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function firstName(fullName: string) {
  const first = fullName.trim().split(/\s+/)[0];
  return first || fullName;
}

export function timeAgo(then: number, now: number) {
  const seconds = Math.max(0, Math.round((now - then) / 1000));
  if (seconds < 45) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return `${hours} h ago`;
}

export interface Trend {
  /** Absolute size of the change, already rounded to whole percent. */
  pct: number;
  direction: 'up' | 'down' | 'flat';
}

/**
 * Percentage change, or null when it cannot honestly be calculated —
 * a zero (or missing) baseline has no meaningful "% ahead".
 */
export function trendBetween(current: number, previous: number): Trend | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous <= 0) {
    return null;
  }

  const change = Math.round(((current - previous) / previous) * 100);

  return {
    pct: Math.abs(change),
    direction: change > 0 ? 'up' : change < 0 ? 'down' : 'flat',
  };
}

const sum = (points: ChartPoint[]) => points.reduce((total, p) => total + p.total, 0);

// The API returns the chart oldest-first and ending with today on the
// business calendar, so "today" is the last point and "yesterday" the one
// before it — no day keys to rebuild (and get wrong) on the client.
export function dayOverDay(chart: ChartPoint[] | undefined) {
  if (!chart || chart.length < 2) return null;

  const today = chart[chart.length - 1].total;
  const yesterday = chart[chart.length - 2].total;

  return { today, yesterday, trend: trendBetween(today, yesterday) };
}

export function weekOverWeek(chart: ChartPoint[] | undefined) {
  if (!chart || chart.length === 0) return null;

  const current = sum(chart.slice(-7));
  const previous = sum(chart.slice(-14, -7));

  return { current, previous, trend: trendBetween(current, previous) };
}

/**
 * The last `days` points, the `days` before them, and their totals. The
 * previous period only counts as comparable when it is complete and non-empty.
 */
export function splitPeriods(chart: ChartPoint[], days: number) {
  const current = chart.slice(-days);
  const earlier = chart.slice(-days * 2, -days);

  const total = sum(current);
  const previousTotal = sum(earlier);
  const comparable = earlier.length === current.length && previousTotal > 0;

  return {
    current,
    previous: comparable ? earlier : [],
    total,
    previousTotal,
    trend: comparable ? trendBetween(total, previousTotal) : null,
  };
}

export type AttentionTone = 'warn' | 'bad' | 'neutral';

export interface AttentionItem {
  id: string;
  icon: 'stock' | 'credit' | 'invoice';
  label: string;
  tone: AttentionTone;
  href: string;
  /** Module the destination page needs — the caller drops the link if the user lacks it. */
  module: ModuleKey;
}

/**
 * Everything here is counted from data the summary endpoint already returns.
 * A section the user cannot see simply produces no item, so the strip stays
 * empty rather than filled with an invented number.
 */
export function attentionItems(data: DashboardSummary | null): AttentionItem[] {
  if (!data) return [];

  const items: AttentionItem[] = [];

  // The API returns the full low-stock count separately from the
  // ten low-stock rows displayed on the dashboard.
  const lowStockCount = data.lowStockCount ?? 0;
  const outOfStock = data.outOfStockCount ?? 0;

  if (lowStockCount > 0) {
    items.push({
      id: 'low-stock',
      icon: 'stock',
      label:
        `${lowStockCount} ${plural(lowStockCount, 'item')} running low` +
        (outOfStock > 0 ? ` · ${outOfStock} out of stock` : ''),
      tone: outOfStock > 0 ? 'bad' : 'warn',
      href: '/inventory?filter=low',
      module: 'INVENTORY',
    });
  }

  if (data.unpaid && data.unpaid.count > 0) {
    const { count, total } = data.unpaid;

    items.push({
      id: 'unpaid',
      icon: 'invoice',
      label: `${count} unpaid ${plural(count, 'invoice')} · ${moneyLabel(total)}`,
      tone: 'warn',
      href: '/invoices',
      module: 'INVOICES',
    });
  }

  return items;
}

export type PaymentSlice = NonNullable<DashboardSummary['paymentMix']>[number];

const PAYMENT_LABELS: Record<string, string> = {
  CASH: 'Cash',
  MPESA: 'M-Pesa',
  CARD: 'Card',
  CREDIT: 'On account',
};

export function paymentLabel(method: string) {
  return PAYMENT_LABELS[method] ?? method;
}

const PAYMENT_COLORS: Record<string, string> = {
  CASH: 'var(--color-status-ok)',
  MPESA: 'var(--color-accent)',
  CARD: 'var(--color-ink-400)',
  CREDIT: 'var(--color-status-warn)',
};

export function paymentColor(method: string) {
  return PAYMENT_COLORS[method] ?? 'var(--color-ink-600)';
}

export function truncate(value: string, max: number) {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}
