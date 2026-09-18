'use client';

import Link from 'next/link';
import { AlertTriangle, CheckCircle2, PackageSearch, Receipt, Wallet } from 'lucide-react';
import type { ModuleKey } from '../../lib/constants';
import type { DashboardSummary } from '../../lib/dashboard-api';
import { attentionItems, dayOverDay, firstName, greetingFor, money, type AttentionItem } from './dashboard-derive';
import { toneColors } from './DashboardPrimitives';

const ICONS = { stock: PackageSearch, credit: Wallet, invoice: Receipt } as const;

function AttentionChip({ item, linked }: { item: AttentionItem; linked: boolean }) {
  const Icon = ICONS[item.icon];
  const colors = toneColors(item.tone === 'bad' ? 'bad' : 'warn');
  const body = (
    <span
      className="flex min-h-9 items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs font-medium"
      style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-ink-900)' }}
    >
      <Icon size={14} strokeWidth={2} style={{ color: colors.fg }} />
      {item.label}
    </span>
  );
  if (!linked) return body;
  return (
    <Link href={item.href} title={`Open ${item.href.replace('/', '')}`}>
      {body}
    </Link>
  );
}

/**
 * Greeting, one sentence of sales context, and the "needs attention" strip.
 * Every line here is conditional: if the underlying data is missing — because
 * of permissions or because there is simply nothing yet — the line is dropped
 * rather than filled in.
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

  let salesLine: string | null = null;
  if (data?.sales) {
    if (comparison?.trend && comparison.trend.direction !== 'flat') {
      const word = comparison.trend.direction === 'up' ? 'ahead of' : 'behind';
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
    <div className="flex flex-col gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl" style={{ color: 'var(--color-ink-900)' }}>
          {greetingFor()}, {firstName(userName)}.
        </h1>
        {salesLine && (
          <p className="mt-1 text-sm" style={{ color: 'var(--color-ink-600)' }}>
            {salesLine}
          </p>
        )}
      </div>

      {data && (
        <div className="flex flex-col gap-2">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase" style={{ color: 'var(--color-ink-600)', letterSpacing: '0.06em' }}>
            {items.length > 0 ? <AlertTriangle size={12} strokeWidth={2.2} /> : <CheckCircle2 size={12} strokeWidth={2.2} />}
            {items.length > 0 ? 'Needs attention' : 'All clear'}
          </p>
          {items.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {items.map((item) => (
                <AttentionChip key={item.id} item={item} linked={hasPermission(item.module)} />
              ))}
            </div>
          ) : (
            <p className="text-sm" style={{ color: 'var(--color-ink-600)' }}>
              Nothing is flagged right now.
            </p>
          )}
        </div>
      )}
    </div>
  );
}