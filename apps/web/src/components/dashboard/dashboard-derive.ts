import type { ModuleKey } from '../../lib/constants';
import type { DashboardSummary } from '../../lib/dashboard-api';

export type ChartPoint = { date: string; total: number };

export function money(n: number) {
  return `KSh ${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export function fmtDate(iso: string) {
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' }).format(new Date(iso));
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
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous <= 0) return null;
  const change = Math.round(((current - previous) / previous) * 100);
  return { pct: Math.abs(change), direction: change > 0 ? 'up' : change < 0 ? 'down' : 'flat' };
}

// The API builds its chart keys from `paidAt.toISOString().slice(0, 10)`, so
// every comparison below is done on the same UTC day boundary. Mixing in a
// local-midnight key would silently shift sales made late in the evening.
function utcDayKey(daysAgo: number, now: Date) {
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

function keyedTotals(chart: ChartPoint[]) {
  const map = new Map<string, number>();
  for (const point of chart) map.set(point.date, point.total);
  return map;
}

export function dayOverDay(chart: ChartPoint[] | undefined, now = new Date()) {
  if (!chart || chart.length === 0) return null;
  const totals = keyedTotals(chart);
  const today = totals.get(utcDayKey(0, now)) ?? 0;
  const yesterday = totals.get(utcDayKey(1, now)) ?? 0;
  return { today, yesterday, trend: trendBetween(today, yesterday) };
}

export function weekOverWeek(chart: ChartPoint[] | undefined, now = new Date()) {
  if (!chart || chart.length === 0) return null;
  const totals = keyedTotals(chart);
  let current = 0;
  let previous = 0;
  for (let i = 0; i < 7; i++) current += totals.get(utcDayKey(i, now)) ?? 0;
  for (let i = 7; i < 14; i++) previous += totals.get(utcDayKey(i, now)) ?? 0;
  return { current, previous, trend: trendBetween(current, previous) };
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
 * empty rather than inventing a number.
 */
export function attentionItems(data: DashboardSummary | null): AttentionItem[] {
  if (!data) return [];
  const items: AttentionItem[] = [];

  const lowStockCount = data.lowStock?.length ?? 0;
  if (lowStockCount > 0) {
    items.push({
      id: 'low-stock',
      icon: 'stock',
      label: `${lowStockCount} ${plural(lowStockCount, 'product')} running low`,
      tone: 'warn',
      href: '/inventory',
      module: 'INVENTORY',
    });
  }

  const credit = data.outstandingCredit;
  if (credit) {
    const overLimit = credit.topDebtors.filter((c) => c.overLimit).length;
    if (overLimit > 0) {
      items.push({
        id: 'over-limit',
        icon: 'credit',
        label: `${overLimit} ${plural(overLimit, 'customer')} over credit limit`,
        tone: 'bad',
        href: '/customers',
        module: 'CUSTOMERS',
      });
    } else if (credit.total > 0) {
      items.push({
        id: 'credit-outstanding',
        icon: 'credit',
        label: `${money(credit.total)} owed by ${credit.customerCount} ${plural(credit.customerCount, 'customer')}`,
        tone: 'warn',
        href: '/customers',
        module: 'CUSTOMERS',
      });
    }
  }

  const recent = data.recentSales;
  if (recent && recent.length > 0) {
    const unpaid = recent.filter((s) => s.status === 'INVOICED').length;
    if (unpaid > 0) {
      items.push({
        id: 'unpaid',
        icon: 'invoice',
        label: `${unpaid} unpaid ${plural(unpaid, 'invoice')} in the latest ${recent.length} sales`,
        tone: 'warn',
        href: '/invoices',
        module: 'INVOICES',
      });
    }
  }

  return items;
}

export interface PaymentSlice {
  method: string;
  count: number;
  total: number;
}

/**
 * Payment split of the sales the summary actually returns (the latest eight).
 * It is labelled as such in the UI — it is not a 30-day share.
 */
export function paymentMix(recentSales: DashboardSummary['recentSales']): PaymentSlice[] {
  if (!recentSales || recentSales.length === 0) return [];
  const byMethod = new Map<string, PaymentSlice>();
  for (const sale of recentSales) {
    if (!sale.paymentMethod) continue;
    const existing = byMethod.get(sale.paymentMethod) ?? { method: sale.paymentMethod, count: 0, total: 0 };
    existing.count += 1;
    existing.total += sale.total;
    byMethod.set(sale.paymentMethod, existing);
  }
  return Array.from(byMethod.values()).sort((a, b) => b.total - a.total);
}

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