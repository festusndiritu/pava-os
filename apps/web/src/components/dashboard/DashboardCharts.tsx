'use client';

import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BarChart3, ExternalLink, PieChart as PieChartIcon, TrendingUp } from 'lucide-react';
import type { DashboardSummary } from '../../lib/dashboard-api';
import { useReducedMotion } from '../../lib/use-reduced-motion';
import {
  fmtDate,
  money,
  paymentColor,
  paymentLabel,
  plural,
  splitPeriods,
  truncate,
  type ChartPoint,
  type PaymentSlice,
} from './dashboard-derive';
import { EmptyState, IconAction, SectionCard, TrendPill } from './DashboardPrimitives';

const AXIS_TICK = { fontSize: 11, fill: 'var(--color-ink-600)' };
const TOOLTIP_STYLE = {
  fontSize: 12,
  borderRadius: 6,
  border: '1px solid var(--color-border)',
  backgroundColor: 'var(--color-surface)',
  color: 'var(--color-ink-900)',
};

function shortMoney(value: number) {
  if (Math.abs(value) >= 1_000_000) return `${Math.round(value / 100_000) / 10}m`;
  if (Math.abs(value) >= 1000) return `${Math.round(value / 1000)}k`;
  return String(Math.round(value));
}

const RANGES = [7, 30, 90] as const;
type Range = (typeof RANGES)[number];

function RangeToggle({ value, onChange, available }: { value: Range; onChange: (r: Range) => void; available: readonly Range[] }) {
  return (
    <div
      role="group"
      aria-label="Date range"
      className="flex items-center rounded-md border p-0.5"
      style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)' }}
    >
      {available.map((range) => {
        const active = range === value;

        return (
          <button
            key={range}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(range)}
            className="min-h-8 rounded px-2.5 text-xs font-medium transition-colors"
            style={{
              backgroundColor: active ? 'var(--color-surface)' : 'transparent',
              color: active ? 'var(--color-ink-900)' : 'var(--color-ink-600)',
              boxShadow: active ? 'var(--shadow-card)' : undefined,
            }}
          >
            {range}d
          </button>
        );
      })}
    </div>
  );
}

/**
 * Paid sales per day as a smooth area, with a 7 / 30 / 90 day range and a
 * dashed line for the equivalent period before it.
 */
export function SalesTrendChart({ chart }: { chart: ChartPoint[] }) {
  const [range, setRange] = useState<Range>(30);
  const reduced = useReducedMotion();

  const available = RANGES.filter((r) => chart.length >= r);
  const active: Range = available.includes(range) ? range : (available[available.length - 1] ?? 30);

  const { rows, total, trend, hasPrevious, daysWithSales, peak } = useMemo(() => {
    const periods = splitPeriods(chart, active);

    const rows = periods.current.map((point, i) => ({
      date: point.date,
      total: point.total,
      previous: periods.previous[i]?.total ?? null,
    }));

    const peak = periods.current.reduce<ChartPoint | null>((best, p) => (!best || p.total > best.total ? p : best), null);

    return {
      rows,
      total: periods.total,
      trend: periods.trend,
      hasPrevious: periods.previous.length > 0,
      daysWithSales: periods.current.filter((p) => p.total > 0).length,
      peak,
    };
  }, [chart, active]);

  const summary =
    `Paid sales per day over the last ${active} days. Total ${money(total)}.` +
    (peak && peak.total > 0 ? ` Best day ${fmtDate(peak.date)} at ${money(peak.total)}.` : '');

  return (
    <SectionCard
      title="Sales trend"
      description={`Paid sales per day, last ${active} days`}
      icon={TrendingUp}
      iconTone="neutral"
      action={<RangeToggle value={active} onChange={setRange} available={available} />}
    >
      {daysWithSales < 2 ? (
        <EmptyState icon={TrendingUp} line="Not enough days with sales in this range to draw a trend." />
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="data-num text-xl font-semibold" style={{ color: 'var(--color-ink-900)' }}>
              {money(total)}
            </span>
            {trend && <TrendPill trend={trend} comparison={`vs previous ${active} days`} className="" />}
            {hasPrevious && (
              <span className="ml-auto flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--color-ink-600)' }}>
                <span className="h-0 w-4 border-t-2 border-dashed" style={{ borderColor: 'var(--color-ink-400)' }} />
                Previous period
              </span>
            )}
          </div>

          <div className="h-56 w-full sm:h-64" role="img" aria-label={summary}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={rows} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="sales-trend-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" style={{ stopColor: 'var(--color-accent)', stopOpacity: 0.35 }} />
                    <stop offset="100%" style={{ stopColor: 'var(--color-accent)', stopOpacity: 0.02 }} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tickFormatter={fmtDate} tick={AXIS_TICK} axisLine={false} tickLine={false} minTickGap={24} />
                <YAxis tickFormatter={shortMoney} tick={AXIS_TICK} axisLine={false} tickLine={false} width={40} />
                <Tooltip
                  formatter={(v) => (typeof v === 'number' ? money(v) : '—')}
                  labelFormatter={fmtDate}
                  contentStyle={TOOLTIP_STYLE}
                  cursor={{ stroke: 'var(--color-border)' }}
                />
                {hasPrevious && (
                  <Area
                    type="monotone"
                    dataKey="previous"
                    name="Previous period"
                    stroke="var(--color-ink-400)"
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    fill="none"
                    dot={false}
                    activeDot={false}
                    isAnimationActive={!reduced}
                  />
                )}
                <Area
                  type="monotone"
                  dataKey="total"
                  name="This period"
                  stroke="var(--color-accent)"
                  strokeWidth={2}
                  fill="url(#sales-trend-fill)"
                  dot={false}
                  activeDot={{ r: 4 }}
                  isAnimationActive={!reduced}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </SectionCard>
  );
}

/** Tiny 7-day line for the "Last 7 days" stat card. */
export function WeekSparkline({ chart }: { chart: ChartPoint[] }) {
  const reduced = useReducedMotion();
  const points = chart.slice(-7);

  if (points.length < 2 || !points.some((p) => p.total > 0)) return null;

  return (
    <div className="h-12 w-full" role="img" aria-label={`Paid sales per day for the last 7 days, ${money(points.reduce((s, p) => s + p.total, 0))} in total`}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 4, right: 2, bottom: 2, left: 2 }}>
          <defs>
            <linearGradient id="week-spark-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" style={{ stopColor: 'var(--color-status-ok)', stopOpacity: 0.3 }} />
              <stop offset="100%" style={{ stopColor: 'var(--color-status-ok)', stopOpacity: 0 }} />
            </linearGradient>
          </defs>
          {/* Hidden, but it makes the tooltip label points by date instead of by index. */}
          <XAxis dataKey="date" hide />
          <YAxis hide domain={[0, 'dataMax']} />
          <Tooltip
            formatter={(v) => (typeof v === 'number' ? money(v) : '—')}
            labelFormatter={fmtDate}
            contentStyle={{ ...TOOLTIP_STYLE, fontSize: 11, padding: '4px 8px' }}
            cursor={{ stroke: 'var(--color-border)' }}
          />
          <Area
            type="monotone"
            dataKey="total"
            name="Sales"
            stroke="var(--color-status-ok)"
            strokeWidth={1.75}
            fill="url(#week-spark-fill)"
            dot={false}
            activeDot={{ r: 3 }}
            isAnimationActive={!reduced}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Revenue of the same top products already listed below, as a horizontal bar. */
export function TopProductsChart({
  topProducts,
  href,
}: {
  topProducts: NonNullable<DashboardSummary['topProducts']>;
  /** Where "see all" goes; omitted when the user cannot open it. */
  href?: string;
}) {
  const reduced = useReducedMotion();

  // Axis labels are truncated to stay readable on a phone; the tooltip maps
  // the shortened label back to the product's full name.
  const data = topProducts.map((p) => ({ ...p, short: truncate(p.name, 14) }));
  const fullNames = new Map(data.map((p) => [p.short, p.name]));
  const summary = `Revenue by product, last 30 days. ${data.map((p) => `${p.name} ${money(p.revenue)}`).join('; ')}.`;

  return (
    <SectionCard
      title="Revenue by product"
      description="Top sellers, last 30 days"
      icon={BarChart3}
      iconTone="neutral"
      action={href ? <IconAction href={href} label="View products" icon={ExternalLink} /> : undefined}
    >
      <div className="h-56 w-full" role="img" aria-label={summary}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, bottom: 0, left: 0 }}>
            <XAxis type="number" tickFormatter={shortMoney} tick={AXIS_TICK} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="short" tick={AXIS_TICK} axisLine={false} tickLine={false} width={92} />
            <Tooltip
              formatter={(v) => (typeof v === 'number' ? money(v) : '—')}
              labelFormatter={(label) => fullNames.get(String(label)) ?? String(label)}
              contentStyle={TOOLTIP_STYLE}
              cursor={{ fill: 'var(--color-bg)' }}
            />
            <Bar dataKey="revenue" name="Revenue" fill="var(--color-accent)" radius={[0, 3, 3, 0]} barSize={14} isAnimationActive={!reduced} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </SectionCard>
  );
}

/** Payment split of paid sales over the last 30 days. */
export function PaymentMixChart({ slices }: { slices: PaymentSlice[] }) {
  const reduced = useReducedMotion();
  const counted = slices.reduce((sum, s) => sum + s.count, 0);
  const total = slices.reduce((sum, s) => sum + s.total, 0);

  const summary = `Payment mix, last 30 days. ${slices
    .map((s) => `${paymentLabel(s.method)} ${total > 0 ? Math.round((s.total / total) * 100) : 0}%`)
    .join(', ')}.`;

  return (
    <SectionCard
      title="Payment mix"
      description={counted > 0 ? `${counted} paid ${plural(counted, 'sale')}, last 30 days` : 'How sales were paid, last 30 days'}
      icon={PieChartIcon}
      iconTone="neutral"
    >
      {slices.length === 0 ? (
        <EmptyState icon={PieChartIcon} line="No settled sales to split yet." />
      ) : (
        <div className="flex flex-col items-center gap-4 sm:flex-row">
          <div className="h-40 w-full max-w-[180px] shrink-0" role="img" aria-label={summary}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={slices} dataKey="total" nameKey="method" innerRadius="58%" outerRadius="86%" paddingAngle={2} stroke="none" isAnimationActive={!reduced}>
                  {slices.map((slice) => (
                    <Cell key={slice.method} fill={paymentColor(slice.method)} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v, name) => [typeof v === 'number' ? money(v) : '—', paymentLabel(String(name))]}
                  contentStyle={TOOLTIP_STYLE}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="flex w-full min-w-0 flex-col gap-2">
            {slices.map((slice) => (
              <li key={slice.method} className="flex items-center gap-2 text-sm">
                <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: paymentColor(slice.method) }} />
                <span className="min-w-0 flex-1 truncate" style={{ color: 'var(--color-ink-900)' }}>
                  {paymentLabel(slice.method)}
                </span>
                <span className="data-num shrink-0 text-xs" style={{ color: 'var(--color-ink-600)' }}>
                  {total > 0 ? `${Math.round((slice.total / total) * 100)}%` : '—'} · {money(slice.total)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </SectionCard>
  );
}
