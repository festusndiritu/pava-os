'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import {
  AlertTriangle,
  Boxes,
  CalendarRange,
  ExternalLink,
  Package,
  Receipt,
  ShoppingCart,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { useAuth } from '../../../lib/auth-context';
import { dashboardApi, type DashboardSummary } from '../../../lib/dashboard-api';
import { OverviewHeader } from '../../../components/dashboard/OverviewHeader';
import { PaymentMixChart, SalesTrendChart, TopProductsChart } from '../../../components/dashboard/DashboardCharts';
import { Badge, IconAction, ListRow, SectionCard, SectionLink, StatCard } from '../../../components/dashboard/DashboardPrimitives';
import { dayOverDay, fmtDate, money, plural, weekOverWeek } from '../../../components/dashboard/dashboard-derive';

function EmptyState({ icon: Icon, line }: { icon: LucideIcon; line: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5 py-8 text-center">
      <Icon size={20} strokeWidth={1.5} style={{ color: 'var(--color-ink-400)' }} />
      <p className="text-sm" style={{ color: 'var(--color-ink-600)' }}>
        {line}
      </p>
    </div>
  );
}

const SALE_STATUS: Record<string, { label: string; tone: 'ok' | 'warn' | 'bad' | 'neutral' }> = {
  PAID: { label: 'Paid', tone: 'ok' },
  INVOICED: { label: 'Unpaid', tone: 'warn' },
  CANCELLED: { label: 'Cancelled', tone: 'bad' },
  DRAFT: { label: 'Draft', tone: 'neutral' },
};

export default function DashboardPage() {
  const { user, hasPermission } = useAuth();
  const [data, setData] = useState<DashboardSummary | null>(null);

  useEffect(() => {
    dashboardApi.summary().then(setData);
  }, []);

  if (!user) return null;

  const nothingToShow = data && !data.sales && !data.lowStock && !data.recentSales && !data.topProducts;

  const today = dayOverDay(data?.chart);
  const week = weekOverWeek(data?.chart);
  const lowStockCount = data?.lowStock?.length ?? 0;
  // const unsettled = data?.recentSales?.filter((s) => s.status === 'INVOICED').length ?? 0;

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <OverviewHeader userName={user.name} data={data} hasPermission={hasPermission} />
        </div>

        {hasPermission('INVENTORY') && (
          <Link
            href="/inventory"
            className="flex min-h-9 items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium"
            style={{
              borderColor: 'var(--color-border)',
              color: 'var(--color-ink-900)',
              backgroundColor: 'var(--color-surface)',
            }}
          >
            <Package size={15} strokeWidth={2} />
            Receive stock
          </Link>
        )}
      </div>

      {!data && (
        <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 xl:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-lg"
              style={{ backgroundColor: 'var(--color-border)' }}
            />
          ))}
        </div>
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
      {data && (data.sales || data.recentSales || data.lowStock) && (
        <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 xl:grid-cols-4">
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
              />

              <StatCard
                label="Last 7 days"
                value={money(data.sales.week.total)}
                sub={`${data.sales.week.count} ${plural(data.sales.week.count, 'sale')}`}
                icon={TrendingUp}
                tone="ok"
                trend={week?.trend}
                trendComparison="vs previous 7 days"
              />

              <StatCard
                label="Last 30 days"
                value={money(data.sales.month.total)}
                sub={`${data.sales.month.count} ${plural(data.sales.month.count, 'sale')}`}
                icon={CalendarRange}
                tone="neutral"
              />
            </>
          )}

          {data.lowStock && (
            <StatCard
              label="Low stock"
              value={String(lowStockCount)}
              sub={`${plural(lowStockCount, 'item')} at or below threshold`}
              icon={Boxes}
              tone={lowStockCount > 0 ? 'bad' : 'ok'}
            />
          )}
        </div>
      )}

      {/* Analytics */}
      {data?.chart &&
        (data.chart.length > 1 ? (
          <SalesTrendChart chart={data.chart} />
        ) : (
          <SectionCard
            title="Sales trend"
            description="Paid sales per day, last 30 days"
            icon={TrendingUp}
          >
            <EmptyState
              icon={TrendingUp}
              line="Not enough days with sales yet to draw a trend."
            />
          </SectionCard>
        ))}

      {(data?.topProducts || data?.recentSales) && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {data?.topProducts &&
            (data.topProducts.length > 0 ? (
              <TopProductsChart topProducts={data.topProducts} />
            ) : (
              <SectionCard
                title="Revenue by product"
                description="Top sellers, last 30 days"
                icon={TrendingUp}
              >
                <EmptyState
                  icon={TrendingUp}
                  line="Nothing sold in the last 30 days."
                />
              </SectionCard>
            ))}

          {data?.recentSales && <PaymentMixChart recentSales={data.recentSales} />}
        </div>
      )}

      {/* Operational overview */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {data?.lowStock && (
          <SectionCard
            title="Low stock"
            description="At or below the reorder threshold"
            icon={AlertTriangle}
            iconTone="warn"
            action={
              <IconAction
                href="/inventory"
                label="View inventory"
                icon={ExternalLink}
              />
            }
          >
            <div className="flex flex-col">
              {data.lowStock.length === 0 && (
                <EmptyState
                  icon={Boxes}
                  line="Every product is above its reorder threshold."
                />
              )}

              {data.lowStock.map((p) => (
                <ListRow
                  key={p.id}
                  marker={
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: 'var(--color-status-warn)' }}
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
                  valueTone="var(--color-status-warn)"
                />
              ))}
            </div>
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
                <IconAction
                  href="/invoices"
                  label="View invoices"
                  icon={ExternalLink}
                />
              ) : undefined
            }
          >
            <div className="flex flex-col">
              {data.recentSales.length === 0 && (
                <EmptyState
                  icon={Receipt}
                  line="Sales will appear here as they are rung up."
                />
              )}

              {data.recentSales.map((s) => {
                const status = SALE_STATUS[s.status];

                return (
                  <ListRow
                    key={s.id}
                    title={s.customerLabel}
                    meta={
                      <>
                        {status && (
                          <Badge
                            label={status.label}
                            tone={status.tone}
                          />
                        )}

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

            {hasPermission('INVOICES') && (
              <SectionLink href="/invoices" label="All invoices" />
            )}
          </SectionCard>
        )}
      </div>
    </div>
  );
}