'use client';

import { Bar, BarChart, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BarChart3, PieChart as PieChartIcon, TrendingUp } from 'lucide-react';
import type { DashboardSummary } from '../../lib/dashboard-api';
import { fmtDate, money, paymentColor, paymentLabel, paymentMix, plural, truncate, type ChartPoint } from './dashboard-derive';
import { SectionCard } from './DashboardPrimitives';

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

/** 30-day paid-sales line — the chart that already existed, given its own container. */
export function SalesTrendChart({ chart }: { chart: ChartPoint[] }) {
  return (
    <SectionCard
      title="Sales trend"
      description="Paid sales per day, last 30 days"
      icon={TrendingUp}
      iconTone="neutral"
    >
      <div className="h-56 w-full sm:h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chart} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <XAxis dataKey="date" tickFormatter={fmtDate} tick={AXIS_TICK} axisLine={false} tickLine={false} minTickGap={24} />
            <YAxis tickFormatter={shortMoney} tick={AXIS_TICK} axisLine={false} tickLine={false} width={40} />
            <Tooltip formatter={(v: number) => money(v)} labelFormatter={fmtDate} contentStyle={TOOLTIP_STYLE} cursor={{ stroke: 'var(--color-border)' }} />
            <Line type="monotone" dataKey="total" stroke="var(--color-accent)" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </SectionCard>
  );
}

/** Revenue of the same top products already listed below, as a horizontal bar. */
export function TopProductsChart({ topProducts }: { topProducts: NonNullable<DashboardSummary['topProducts']> }) {
  // Axis labels are truncated to stay readable on a phone; the tooltip maps
  // the shortened label back to the product's full name.
  const data = topProducts.map((p) => ({ ...p, short: truncate(p.name, 14) }));
  const fullNames = new Map(data.map((p) => [p.short, p.name]));
  return (
    <SectionCard title="Revenue by product" description="Top sellers, last 30 days" icon={BarChart3} iconTone="neutral">
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, bottom: 0, left: 0 }}>
            <XAxis type="number" tickFormatter={shortMoney} tick={AXIS_TICK} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="short" tick={AXIS_TICK} axisLine={false} tickLine={false} width={92} />
            <Tooltip
              formatter={(v: number) => money(v)}
              labelFormatter={(label: string) => fullNames.get(label) ?? label}
              contentStyle={TOOLTIP_STYLE}
              cursor={{ fill: 'var(--color-bg)' }}
            />
            <Bar dataKey="revenue" name="Revenue" fill="var(--color-accent)" radius={[0, 3, 3, 0]} barSize={14} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </SectionCard>
  );
}

/**
 * Payment split of the recent sales the summary returns. Deliberately labelled
 * with the sample size — the endpoint does not expose a 30-day payment split.
 */
export function PaymentMixChart({ recentSales }: { recentSales: NonNullable<DashboardSummary['recentSales']> }) {
  const slices = paymentMix(recentSales);
  if (slices.length === 0) return null;
  const counted = slices.reduce((sum, s) => sum + s.count, 0);
  const total = slices.reduce((sum, s) => sum + s.total, 0);

  return (
    <SectionCard
      title="Payment mix"
      description={`Latest ${counted} recorded ${plural(counted, 'sale')}`}
      icon={PieChartIcon}
      iconTone="neutral"
    >
      <div className="flex flex-col items-center gap-4 sm:flex-row">
        <div className="h-40 w-full max-w-[180px] shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={slices} dataKey="total" nameKey="method" innerRadius="58%" outerRadius="86%" paddingAngle={2} stroke="none">
                {slices.map((slice) => (
                  <Cell key={slice.method} fill={paymentColor(slice.method)} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number, name: string) => [money(v), paymentLabel(name)]} contentStyle={TOOLTIP_STYLE} />
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
    </SectionCard>
  );
}