'use client';

import Link from 'next/link';
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  PackageSearch,
  Receipt,
  Wallet,
} from 'lucide-react';
import type { ModuleKey } from '../../lib/constants';
import type { DashboardSummary } from '../../lib/dashboard-api';
import {
  attentionItems,
  dayOverDay,
  firstName,
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
      }}
    >
      <span
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md"
        style={{
          backgroundColor: colors.bg,
          color: colors.fg,
        }}
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
      }}
    >
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <div
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: 'var(--color-accent)' }}
          />
          <span
            className="text-[11px] font-semibold uppercase tracking-[0.08em]"
            style={{ color: 'var(--color-ink-500)' }}
          >
            Overview
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

      {data && (
        <div
          className="border-t pt-4"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <div className="mb-2.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {items.length > 0 ? (
                <span
                  className="flex h-6 w-6 items-center justify-center rounded-md"
                  style={{
                    backgroundColor: 'var(--color-status-warn-bg)',
                    color: 'var(--color-status-warn)',
                  }}
                >
                  <AlertTriangle size={13} strokeWidth={2} />
                </span>
              ) : (
                <span
                  className="flex h-6 w-6 items-center justify-center rounded-md"
                  style={{
                    backgroundColor: 'var(--color-status-ok-bg)',
                    color: 'var(--color-status-ok)',
                  }}
                >
                  <CheckCircle2 size={13} strokeWidth={2} />
                </span>
              )}

              <div>
                <p
                  className="text-xs font-semibold"
                  style={{ color: 'var(--color-ink-900)' }}
                >
                  {items.length > 0 ? 'Needs attention' : 'All clear'}
                </p>

                <p
                  className="text-[11px]"
                  style={{ color: 'var(--color-ink-500)' }}
                >
                  {items.length > 0
                    ? `${items.length} item${items.length === 1 ? '' : 's'} to review`
                    : 'Nothing is flagged right now'}
                </p>
              </div>
            </div>
          </div>

          {items.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {items.map((item) => (
                <AttentionChip
                  key={item.id}
                  item={item}
                  linked={hasPermission(item.module)}
                />
              ))}
            </div>
          ) : (
            <div
              className="flex min-h-10 items-center rounded-lg border px-3 text-sm"
              style={{
                borderColor: 'var(--color-border)',
                backgroundColor: 'var(--color-surface-muted)',
                color: 'var(--color-ink-600)',
              }}
            >
              Nothing needs your attention right now.
            </div>
          )}
        </div>
      )}
    </div>
  );
}