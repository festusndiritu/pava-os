'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { AlertTriangle, ArrowRight, Package, ShoppingCart, TrendingUp, Users } from 'lucide-react';
import { useAuth } from '../../../lib/auth-context';
import { dashboardApi, type DashboardSummary } from '../../../lib/dashboard-api';

function money(n: number) {
  return `KSh ${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}
function fmtDate(iso: string) {
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' }).format(new Date(iso));
}

function Card({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border p-5" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold" style={{ color: 'var(--color-ink-900)' }}>
          {title}
        </h2>
        {action}
      </div>
      {children}
    </div>
  );
}

function KpiTile({ label, total, count }: { label: string; total: number; count: number }) {
  return (
    <div className="rounded-lg border p-4" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
      <p className="text-[11px] font-semibold uppercase" style={{ color: 'var(--color-ink-600)', letterSpacing: '0.06em' }}>
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold data-num" style={{ color: 'var(--color-ink-900)' }}>
        {money(total)}
      </p>
      <p className="text-xs" style={{ color: 'var(--color-ink-600)' }}>
        {count} sale{count === 1 ? '' : 's'}
      </p>
    </div>
  );
}

export default function DashboardPage() {
  const { user, hasPermission } = useAuth();
  const [data, setData] = useState<DashboardSummary | null>(null);

  useEffect(() => {
    dashboardApi.summary().then(setData);
  }, []);

  if (!user) return null;

  const nothingToShow = data && !data.sales && !data.lowStock && !data.outstandingCredit && !data.topProducts;

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight" style={{ color: 'var(--color-ink-900)' }}>
            Dashboard
          </h1>
          <p className="mt-0.5 text-sm" style={{ color: 'var(--color-ink-600)' }}>
            Welcome back, {user.name}.
          </p>
        </div>
        <div className="flex gap-2">
          {hasPermission('POS') && (
            <Link href="/pos" className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-white" style={{ backgroundColor: 'var(--color-accent)' }}>
              <ShoppingCart size={14} strokeWidth={2} />
              Go to POS
            </Link>
          )}
          {hasPermission('INVENTORY') && (
            <Link href="/inventory" className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium" style={{ borderColor: 'var(--color-border)', color: 'var(--color-ink-900)' }}>
              <Package size={14} strokeWidth={2} />
              Receive stock
            </Link>
          )}
        </div>
      </div>

      {!data && (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg" style={{ backgroundColor: 'var(--color-border)' }} />
          ))}
        </div>
      )}

      {nothingToShow && (
        <div className="mt-6 rounded-lg border p-8 text-center" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          <p className="text-sm" style={{ color: 'var(--color-ink-600)' }}>
            Nothing to show here yet for your role — ask an administrator if you think you should have access to more.
          </p>
        </div>
      )}

      {data?.sales && (
        <>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <KpiTile label="Today" total={data.sales.today.total} count={data.sales.today.count} />
            <KpiTile label="Last 7 days" total={data.sales.week.total} count={data.sales.week.count} />
            <KpiTile label="Last 30 days" total={data.sales.month.total} count={data.sales.month.count} />
          </div>

          {data.chart && data.chart.length > 1 && (
            <Card title="Sales trend (30 days)" action={<TrendingUp size={16} strokeWidth={2} style={{ color: 'var(--color-ink-600)' }} />}>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.chart}>
                    <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 11, fill: 'var(--color-ink-600)' }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={(v) => `${Math.round(v / 1000)}k`} tick={{ fontSize: 11, fill: 'var(--color-ink-600)' }} axisLine={false} tickLine={false} width={36} />
                    <Tooltip formatter={(v: number) => money(v)} labelFormatter={fmtDate} contentStyle={{ fontSize: 12, borderRadius: 6 }} />
                    <Line type="monotone" dataKey="total" stroke="var(--color-accent)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}
        </>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {data?.lowStock && data.lowStock.length > 0 && (
          <Card title="Low stock" action={<AlertTriangle size={16} strokeWidth={2} style={{ color: 'var(--color-status-warn)' }} />}>
            <div className="flex flex-col gap-2">
              {data.lowStock.map((p) => (
                <div key={p.id} className="flex items-center justify-between text-sm">
                  <span style={{ color: 'var(--color-ink-900)' }}>{p.name}</span>
                  <span className="data-num font-medium" style={{ color: 'var(--color-status-warn)' }}>
                    {p.stockQuantity} {p.unit}
                  </span>
                </div>
              ))}
            </div>
            <Link href="/inventory" className="mt-3 flex items-center gap-1 text-xs font-medium" style={{ color: 'var(--color-accent)' }}>
              Receive stock <ArrowRight size={12} strokeWidth={2} />
            </Link>
          </Card>
        )}

        {data?.outstandingCredit && data.outstandingCredit.topDebtors.length > 0 && (
          <Card title="Outstanding credit" action={<Users size={16} strokeWidth={2} style={{ color: 'var(--color-ink-600)' }} />}>
            <p className="mb-3 text-sm" style={{ color: 'var(--color-ink-600)' }}>
              {money(data.outstandingCredit.total)} across {data.outstandingCredit.customerCount} customer{data.outstandingCredit.customerCount === 1 ? '' : 's'}
            </p>
            <div className="flex flex-col gap-2">
              {data.outstandingCredit.topDebtors.map((c) => (
                <div key={c.id} className="flex items-center justify-between text-sm">
                  <span style={{ color: 'var(--color-ink-900)' }}>{c.name}</span>
                  <span className="data-num font-medium" style={{ color: c.overLimit ? 'var(--color-status-bad)' : 'var(--color-ink-900)' }}>
                    {money(c.balance)}
                  </span>
                </div>
              ))}
            </div>
            <Link href="/customers" className="mt-3 flex items-center gap-1 text-xs font-medium" style={{ color: 'var(--color-accent)' }}>
              View customers <ArrowRight size={12} strokeWidth={2} />
            </Link>
          </Card>
        )}

        {data?.recentSales && data.recentSales.length > 0 && (
          <Card title="Recent sales">
            <div className="flex flex-col gap-2">
              {data.recentSales.map((s) => (
                <div key={s.id} className="flex items-center justify-between text-sm">
                  <div>
                    <p style={{ color: 'var(--color-ink-900)' }}>{s.customerLabel}</p>
                    <p className="text-xs" style={{ color: 'var(--color-ink-600)' }}>
                      {fmtDate(s.createdAt)} {s.paymentMethod ? `· ${s.paymentMethod}` : ''}
                    </p>
                  </div>
                  <span className="data-num font-medium" style={{ color: 'var(--color-ink-900)' }}>
                    {money(s.total)}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {data?.topProducts && data.topProducts.length > 0 && (
          <Card title="Top products (30 days)">
            <div className="flex flex-col gap-2">
              {data.topProducts.map((p, i) => (
                <div key={p.id} className="flex items-center justify-between text-sm">
                  <span style={{ color: 'var(--color-ink-900)' }}>
                    {i + 1}. {p.name}
                  </span>
                  <span className="data-num" style={{ color: 'var(--color-ink-600)' }}>
                    {p.unitsSold} sold · {money(p.revenue)}
                  </span>
                </div>
              ))}
            </div>
            <Link href="/products" className="mt-3 flex items-center gap-1 text-xs font-medium" style={{ color: 'var(--color-accent)' }}>
              View catalogue <ArrowRight size={12} strokeWidth={2} />
            </Link>
          </Card>
        )}
      </div>
    </div>
  );
}