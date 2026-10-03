'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Boxes,
  CalendarRange,
  ExternalLink,
  Receipt,
  ShoppingCart,
  TrendingUp,
} from 'lucide-react';
import { useAuth } from '../../../lib/auth-context';
import { ApiError } from '../../../lib/api';
import { dashboardApi, type DashboardSummary } from '../../../lib/dashboard-api';
import { OverviewHeader } from '../../../components/dashboard/OverviewHeader';
import { PaymentMixChart, SalesTrendChart, TopProductsChart, WeekSparkline } from '../../../components/dashboard/DashboardCharts';
import {
  Badge,
  EmptyState,
  IconAction,
  ListRow,
  SectionCard,
  SectionLink,
  SectionSkeleton,
  Skeleton,
  StatCard,
} from '../../../components/dashboard/DashboardPrimitives';
import { dayOverDay, fmtDate, money, plural, weekOverWeek } from '../../../components/dashboard/dashboard-derive';

const SALE_STATUS: Record<string, { label: string; tone: 'ok' | 'warn' | 'bad' | 'neutral' }> = {
  PAID: { label: 'Paid', tone: 'ok' },
  INVOICED: { label: 'Unpaid', tone: 'warn' },
  CANCELLED: { label: 'Cancelled', tone: 'bad' },
  DRAFT: { label: 'Draft', tone: 'neutral' },
};

// Written out in full so Tailwind can see every class. The grid follows the
// number of cards the user can actually see, so a restricted account never
// gets an empty column.
const STAT_GRID: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 min-[420px]:grid-cols-2',
  3: 'grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-1 min-[420px]:grid-cols-2 xl:grid-cols-4',
};

/** Refetch when the tab regains focus, but only if the data is older than this. */
const STALE_MS = 60_000;

function errorMessage(error: unknown) {
  if (error instanceof ApiError && error.status >= 500) return 'The server ran into a problem. Please try again in a moment.';
  if (error instanceof ApiError && error.status === 403) return "You don't have access to the dashboard.";
  return 'Check your connection and try again.';
}

export default function DashboardPage() {
  const { user, hasPermission } = useAuth();
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const inFlight = useRef(false);
  const lastAttempt = useRef(0);

  const load = useCallback(async () => {
    if (inFlight.current) return;

    inFlight.current = true;
    lastAttempt.current = Date.now();
    setRefreshing(true);

    try {
      const next = await dashboardApi.summary();
      setData(next);
      setError(null);
      setUpdatedAt(Date.now());
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      inFlight.current = false;
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const refreshIfStale = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastAttempt.current > STALE_MS) void load();
    };

    window.addEventListener('focus', refreshIfStale);
    document.addEventListener('visibilitychange', refreshIfStale);
    const tick = window.setInterval(() => setNow(Date.now()), 30_000);

    return () => {
      window.removeEventListener('focus', refreshIfStale);
      document.removeEventListener('visibilitychange', refreshIfStale);
      window.clearInterval(tick);
    };
  }, [load]);

  if (!user) return null;

  const nothingToShow = data && !data.sales && !data.lowStock && !data.recentSales && !data.topProducts;

  const today = dayOverDay(data?.chart);
  const week = weekOverWeek(data?.chart);
  const lowStockCount = data?.lowStockCount ?? 0;
  const outOfStockCount = data?.outOfStockCount ?? 0;
  const lowStockShown = data?.lowStock?.length ?? 0;

  const statCount = (data?.sales ? 3 : 0) + (data?.lowStock ? 1 : 0);
  const salesHref = hasPermission('INVOICES') ? '/invoices' : undefined;

  const loading = !data && !error;

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 p-4 sm:p-6">
      <OverviewHeader
        userName={user.name}
        data={data}
        hasPermission={hasPermission}
        updatedAt={updatedAt}
        now={now}
        refreshing={refreshing}
        hasError={!!error}
        onRefresh={load}
      />

      {error && !data && (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-3 rounded-lg border p-4"
          style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
        >
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
            style={{ backgroundColor: 'var(--color-status-badSoft)', color: 'var(--color-status-bad)' }}
          >
            <AlertTriangle size={16} strokeWidth={2} />
          </span>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold" style={{ color: 'var(--color-ink-900)' }}>
              We couldn&apos;t load the dashboard
            </p>
            <p className="text-xs" style={{ color: 'var(--color-ink-600)' }}>
              {error}
            </p>
          </div>

          <button
            type="button"
            onClick={() => void load()}
            disabled={refreshing}
            className="min-h-10 rounded-lg border px-3.5 text-sm font-medium disabled:opacity-60"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-ink-900)', backgroundColor: 'var(--color-surface)' }}
          >
            {refreshing ? 'Trying…' : 'Try again'}
          </button>
        </div>
      )}

      {loading && (
        <>
          <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 xl:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
          <SectionSkeleton heightClass="h-64" />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <SectionSkeleton heightClass="h-56" />
            <SectionSkeleton heightClass="h-56" />
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <SectionSkeleton heightClass="h-48" />
            <SectionSkeleton heightClass="h-48" />
          </div>
        </>
      )}

      {nothingToShow && (
        <div
          className="rounded-lg border p-8 text-center"
          style={{
            backgroundColor: 'var(--color-surface)',
            borderColor: 'var(--color-border)',
          }}
        >
          <p className="text-sm" style={{ color: 'var(--color-ink-600)' }}>
            Nothing to show here yet — ask an administrator if you think you should have access to more.
          </p>
        </div>
      )}

      {/* Quick statistics */}
      {data && statCount > 0 && (
        <div className={`grid gap-4 ${STAT_GRID[statCount]}`}>
          {data.sales && (
            <>
              <StatCard
                label="Today"
                value={money(data.sales.today.total)}
                sub={`${data.sales.today.count} ${plural(data.sales.today.count, 'sale')}`}
                icon={ShoppingCart}
                tone="neutral"
                trend={today?.trend}
                trendComparison="vs yesterday"
                href={salesHref}
              />

              <StatCard
                label="Last 7 days"
                value={money(data.sales.week.total)}
                sub={`${data.sales.week.count} ${plural(data.sales.week.count, 'sale')}`}
                icon={TrendingUp}
                tone="ok"
                trend={week?.trend}
                trendComparison="vs previous 7 days"
                footer={data.chart ? <WeekSparkline chart={data.chart} /> : undefined}
                href={salesHref}
              />

              <StatCard
                label="Last 30 days"
                value={money(data.sales.month.total)}
                sub={`${data.sales.month.count} ${plural(data.sales.month.count, 'sale')}`}
                icon={CalendarRange}
                tone="neutral"
                href={salesHref}
              />
            </>
          )}

          {data.lowStock && (
            <StatCard
              label="Low stock"
              value={String(lowStockCount)}
              sub={
                outOfStockCount > 0
                  ? `${outOfStockCount} out of stock`
                  : `${plural(lowStockCount, 'item')} at or below threshold`
              }
              icon={Boxes}
              tone={outOfStockCount > 0 ? 'bad' : lowStockCount > 0 ? 'warn' : 'ok'}
              href={hasPermission('INVENTORY') ? '/inventory?filter=low' : undefined}
            />
          )}
        </div>
      )}

      {/* Analytics */}
      {data?.chart && <SalesTrendChart chart={data.chart} />}

      {(data?.topProducts || data?.paymentMix) && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {data?.topProducts &&
            (data.topProducts.length > 0 ? (
              <TopProductsChart
                topProducts={data.topProducts}
                href={hasPermission('PRODUCTS') ? '/products' : undefined}
              />
            ) : (
              <SectionCard
                title="Revenue by product"
                description="Top sellers, last 30 days"
                icon={TrendingUp}
              >
                <EmptyState icon={TrendingUp} line="Nothing sold in the last 30 days." />
              </SectionCard>
            ))}

          {data?.paymentMix && <PaymentMixChart slices={data.paymentMix} />}
        </div>
      )}

      {/* Operational overview */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {data?.lowStock && (
          <SectionCard
            title="Low stock"
            description={
              lowStockCount > lowStockShown
                ? `Showing ${lowStockShown} of ${lowStockCount} · largest shortfall first`
                : 'At or below the reorder threshold'
            }
            icon={AlertTriangle}
            iconTone="warn"
            action={
              <IconAction
                href="/inventory?filter=low"
                label="View inventory"
                icon={ExternalLink}
              />
            }
          >
            <div className="flex flex-col">
              {data.lowStock.length === 0 && (
                <EmptyState icon={Boxes} line="Every product is above its reorder threshold." />
              )}

              {data.lowStock.map((p) => (
                <ListRow
                  key={p.id}
                  href="/inventory?filter=low"
                  marker={
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{
                        backgroundColor:
                          p.stockQuantity <= 0 ? 'var(--color-status-bad)' : 'var(--color-status-warn)',
                      }}
                    />
                  }
                  title={p.name}
                  meta={
                    p.kind === 'family' ? (
                      <Badge label="Family total" tone="neutral" />
                    ) : (
                      `Threshold ${p.threshold} ${p.unit}`
                    )
                  }
                  value={`${p.stockQuantity} ${p.unit}`}
                  valueTone={p.stockQuantity <= 0 ? 'var(--color-status-bad)' : 'var(--color-status-warn)'}
                />
              ))}
            </div>

            {lowStockCount > lowStockShown && (
              <SectionLink href="/inventory?filter=low" label={`View all ${lowStockCount} low-stock items`} />
            )}
          </SectionCard>
        )}

        {data?.recentSales && (
          <SectionCard
            title="Recent sales"
            description="Latest invoiced and paid documents"
            icon={Receipt}
            iconTone="neutral"
            action={
              hasPermission('INVOICES') ? (
                <IconAction href="/invoices" label="View invoices" icon={ExternalLink} />
              ) : undefined
            }
          >
            <div className="flex flex-col">
              {data.recentSales.length === 0 && (
                <EmptyState icon={Receipt} line="Sales will appear here as they are rung up." />
              )}

              {data.recentSales.map((s) => {
                const status = SALE_STATUS[s.status];

                return (
                  <ListRow
                    key={s.id}
                    href={salesHref}
                    title={s.customerLabel}
                    meta={
                      <>
                        {status && <Badge label={status.label} tone={status.tone} />}

                        <span className="truncate">
                          {fmtDate(s.createdAt)}
                          {s.paymentMethod ? ` · ${s.paymentMethod}` : ''}
                        </span>
                      </>
                    }
                    value={money(s.total)}
                  />
                );
              })}
            </div>

            {hasPermission('INVOICES') && <SectionLink href="/invoices" label="All invoices" />}
          </SectionCard>
        )}
      </div>
    </div>
  );
}
