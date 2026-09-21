'use client';

import { useEffect, useState } from 'react';
import { Bar, BarChart, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BarChart3, Boxes, CircleDollarSign, PieChart as PieChartIcon, Receipt, ShoppingCart, TrendingUp, Undo2, UserRound, Users } from 'lucide-react';
import { useAuth } from '../../../lib/auth-context';
import {
  analyticsApi,
  type AnalyticsOverview,
  type CategorySalesRow,
  type InventorySnapshot,
  type PaymentMixRow,
  type StaffPerformanceRow,
  type TopCustomerRow,
  type TopProductRow,
} from '../../../lib/analytics-api';
import { RangeBar, useDateRange } from '../../../components/insights/RangeBar';
import { ListRow, SectionCard, StatCard } from '../../../components/dashboard/DashboardPrimitives';
import { fmtDate, money, paymentColor, paymentLabel, plural, trendBetween, truncate } from '../../../components/dashboard/dashboard-derive';

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

function Empty({ line }: { line: string }) {
  return (
    <p className="py-8 text-center text-sm" style={{ color: 'var(--color-ink-600)' }}>
      {line}
    </p>
  );
}

function RankRow({ index }: { index: number }) {
  return (
    <span
      className="data-num flex h-6 w-6 shrink-0 items-center justify-center rounded text-xs font-semibold"
      style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-ink-600)' }}
    >
      {index + 1}
    </span>
  );
}

interface Loaded {
  overview: AnalyticsOverview;
  categories: CategorySalesRow[];
  payments: PaymentMixRow[];
  products: TopProductRow[];
  customers: TopCustomerRow[];
  staff: StaffPerformanceRow[];
  inventory: InventorySnapshot;
}

export default function AnalyticsPage() {
  const { hasPermission } = useAuth();
  const { range, preset, setPreset, setBound } = useDateRange('30d');
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    Promise.all([
      analyticsApi.overview(range),
      analyticsApi.salesByCategory(range),
      analyticsApi.paymentMix(range),
      analyticsApi.topProducts(range),
      analyticsApi.topCustomers(range),
      analyticsApi.staffPerformance(range),
      analyticsApi.inventorySnapshot(),
    ])
      .then(([overview, categories, payments, products, customers, staff, inventory]) => {
        if (cancelled) return;
        setData({ overview, categories, payments, products, customers, staff, inventory });
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Could not load analytics');
      });
    return () => {
      cancelled = true;
    };
  }, [range.from, range.to]);

  if (!hasPermission('ANALYTICS')) {
    return (
      <div className="p-6">
        <p className="text-sm" style={{ color: 'var(--color-ink-600)' }}>
          You don&apos;t have access to this page.
        </p>
      </div>
    );
  }

  const o = data?.overview;
  const prev = o?.previous;
  const paymentSlices = (data?.payments ?? []).map((row) => ({
    ...row,
    key: row.method ?? 'UNSPECIFIED',
    label: row.method ? paymentLabel(row.method) : 'Unspecified',
  }));

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-5 p-4 sm:p-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight" style={{ color: 'var(--color-ink-900)' }}>
          Analytics
        </h1>
        <p className="mt-0.5 text-sm" style={{ color: 'var(--color-ink-600)' }}>
          Revenue, margin and mix over a period. Sales count once settled — paid, or invoiced and still open.
        </p>
      </div>

      <RangeBar range={range} preset={preset} onPreset={setPreset} onBound={setBound} />

      {error && (
        <div className="rounded-md px-3 py-2 text-sm" style={{ backgroundColor: 'var(--color-status-badSoft)', color: 'var(--color-status-bad)' }}>
          {error}
        </div>
      )}

      {!data && !error && (
        <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 xl:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-lg" style={{ backgroundColor: 'var(--color-border)' }} />
          ))}
        </div>
      )}

      {o && (
        <>
          <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Revenue"
              value={money(o.revenue)}
              sub={`${o.ordersCount} ${plural(o.ordersCount, 'sale')}`}
              icon={CircleDollarSign}
              tone="neutral"
              trend={prev ? trendBetween(o.revenue, prev.revenue) : null}
              trendComparison="vs previous period"
            />
            <StatCard
              label="Gross profit"
              value={money(o.grossProfit)}
              sub={o.marginPct === null ? 'No sales in range' : `${o.marginPct.toFixed(1)}% margin · ${money(o.cogs)} cost`}
              icon={TrendingUp}
              tone={o.grossProfit >= 0 ? 'ok' : 'bad'}
              trend={prev ? trendBetween(o.grossProfit, prev.grossProfit) : null}
              trendComparison="vs previous period"
            />
            <StatCard
              label="Average sale"
              value={money(o.avgOrderValue)}
              sub={`${o.ordersCount} ${plural(o.ordersCount, 'sale')} in range`}
              icon={ShoppingCart}
              tone="neutral"
              trend={prev ? trendBetween(o.avgOrderValue, prev.avgOrderValue) : null}
              trendComparison="vs previous period"
            />
            <StatCard
              label="Returns"
              value={money(o.returnsTotal)}
              sub={`${o.returnsCount} ${plural(o.returnsCount, 'return')} credited back`}
              icon={Undo2}
              tone={o.returnsCount > 0 ? 'warn' : 'ok'}
            />
          </div>

          <SectionCard title="Revenue" description="Settled sales per day" icon={TrendingUp}>
            {o.chart.length > 1 ? (
              <div className="h-56 w-full sm:h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={o.chart} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                    <XAxis dataKey="date" tickFormatter={fmtDate} tick={AXIS_TICK} axisLine={false} tickLine={false} minTickGap={24} />
                    <YAxis tickFormatter={shortMoney} tick={AXIS_TICK} axisLine={false} tickLine={false} width={40} />
                    <Tooltip formatter={(v: number) => money(v)} labelFormatter={fmtDate} contentStyle={TOOLTIP_STYLE} cursor={{ stroke: 'var(--color-border)' }} />
                    <Line type="monotone" dataKey="total" stroke="var(--color-accent)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <Empty line="Not enough days with sales in this range to draw a trend." />
            )}
          </SectionCard>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <SectionCard title="Sales by category" description="Revenue share of the catalogue" icon={BarChart3}>
              {data.categories.length > 0 ? (
                <div className="h-56 w-full sm:h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.categories.slice(0, 8)} layout="vertical" margin={{ top: 4, right: 12, bottom: 0, left: 0 }}>
                      <XAxis type="number" tickFormatter={shortMoney} tick={AXIS_TICK} axisLine={false} tickLine={false} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        tickFormatter={(v: string) => truncate(v, 14)}
                        tick={AXIS_TICK}
                        axisLine={false}
                        tickLine={false}
                        width={92}
                      />
                      <Tooltip formatter={(v: number) => money(v)} contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'var(--color-bg)' }} />
                      <Bar dataKey="revenue" fill="var(--color-accent)" radius={[0, 3, 3, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <Empty line="Nothing sold in this range." />
              )}
            </SectionCard>

            <SectionCard title="Payment mix" description="How settled sales were paid" icon={PieChartIcon}>
              {paymentSlices.length > 0 ? (
                <div className="flex flex-col items-center gap-4 sm:flex-row">
                  <div className="h-44 w-full sm:w-1/2">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={paymentSlices} dataKey="total" nameKey="label" innerRadius={38} outerRadius={64} paddingAngle={2}>
                          {paymentSlices.map((slice) => (
                            <Cell key={slice.key} fill={paymentColor(slice.key)} stroke="none" />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: number) => money(v)} contentStyle={TOOLTIP_STYLE} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex w-full flex-col gap-2 sm:w-1/2">
                    {paymentSlices.map((slice) => (
                      <div key={slice.key} className="flex items-center gap-2 text-sm">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: paymentColor(slice.key) }} />
                        <span className="min-w-0 flex-1 truncate" style={{ color: 'var(--color-ink-600)' }}>
                          {slice.label}
                        </span>
                        <span className="data-num font-medium" style={{ color: 'var(--color-ink-900)' }}>
                          {money(slice.total)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <Empty line="No settled sales recorded a payment method in this range." />
              )}
            </SectionCard>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <SectionCard title="Top products" description="By revenue in range" icon={Receipt} iconTone="ok">
              <div className="flex flex-col">
                {data.products.length === 0 && <Empty line="Nothing sold in this range." />}
                {data.products.map((p, i) => (
                  <ListRow key={p.id} marker={<RankRow index={i} />} title={p.name} meta={`${p.unitsSold} sold`} value={money(p.revenue)} />
                ))}
              </div>
            </SectionCard>

            <SectionCard title="Top customers" description="By revenue in range" icon={Users} iconTone="neutral">
              <div className="flex flex-col">
                {data.customers.length === 0 && <Empty line="No sales were attached to a customer in this range." />}
                {data.customers.map((c, i) => (
                  <ListRow
                    key={c.id}
                    marker={<RankRow index={i} />}
                    title={c.name}
                    meta={`${c.orderCount} ${plural(c.orderCount, 'sale')}`}
                    value={money(c.revenue)}
                  />
                ))}
              </div>
            </SectionCard>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <SectionCard title="Staff performance" description="Sales rung up, by who raised the document" icon={UserRound} iconTone="neutral">
              <div className="flex flex-col">
                {data.staff.length === 0 && <Empty line="No settled sales in this range." />}
                {data.staff.map((s, i) => (
                  <ListRow
                    key={s.id}
                    marker={<RankRow index={i} />}
                    title={s.name}
                    meta={`${s.orderCount} ${plural(s.orderCount, 'sale')} · ${money(s.avgOrderValue)} average`}
                    value={money(s.revenue)}
                  />
                ))}
              </div>
            </SectionCard>

            <SectionCard
              title="Stock on hand"
              description="Valued at last received cost — a snapshot of right now, not the range"
              icon={Boxes}
              iconTone={data.inventory.uncostedUnits > 0 ? 'warn' : 'neutral'}
            >
              <p className="data-num mb-3 text-xl font-semibold" style={{ color: 'var(--color-ink-900)' }}>
                {money(data.inventory.totalValue)}
              </p>
              {data.inventory.uncostedUnits > 0 && (
                <p className="mb-3 text-xs" style={{ color: 'var(--color-status-warn)' }}>
                  {data.inventory.uncostedUnits} {plural(data.inventory.uncostedUnits, 'unit')} have no recorded cost, so this figure is understated.
                </p>
              )}
              <div className="flex flex-col">
                {data.inventory.categories.length === 0 && <Empty line="No active products in the catalogue." />}
                {data.inventory.categories.slice(0, 8).map((c) => (
                  <ListRow key={c.id} title={c.name} meta={`${c.qty} ${plural(c.qty, 'unit')}`} value={money(c.value)} />
                ))}
              </div>
            </SectionCard>
          </div>
        </>
      )}
    </div>
  );
}
