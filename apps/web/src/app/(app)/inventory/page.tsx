'use client';

import { useEffect, useState, Fragment, type KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Boxes, ClipboardList, Plus, Search, X } from 'lucide-react';
import { inventoryApi, type InventoryReceipt, type InventorySummary, type Product, type ReceiptKind, type StockFilter } from '../../../lib/products-api';
import { ReceiveInventoryDrawer } from '../../../components/inventory/ReceiveInventoryDrawer';
import { StockLevelsTable } from '../../../components/inventory/StockLevelsTable';
import { ProductDetailDrawer } from '../../../components/products/ProductDetailDrawer';
import { ListFooter } from '../../../components/ui/ListFooter';
import { useAuth } from '../../../lib/auth-context';
import { fmtNumber } from '../../../lib/format';
import { activateOnKey } from '../../../lib/a11y';
import { usePagedList, useDebounced } from '../../../lib/use-paged-list';

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));
}

type TabKey = 'levels' | 'receipts';
const TABS: { key: TabKey; label: string; icon: typeof Boxes }[] = [
  { key: 'levels', label: 'Stock levels', icon: Boxes },
  { key: 'receipts', label: 'Receipts', icon: ClipboardList },
];

const KINDS: { value: ReceiptKind | ''; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'delivery', label: 'Supplier deliveries' },
  { value: 'other', label: 'Adjustments & returns' },
];

// Receipts the system writes itself so a stock change has a cost lot behind it.
const SYSTEM_SUPPLIERS = new Set(['Stock adjustment', 'Customer return', 'Opening Balance']);

const inputStyle = { borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-ink-900)' };

function SummaryCard({ label, value, hint, tone = 'default', onClick }: { label: string; value: string; hint?: string; tone?: 'default' | 'warn' | 'bad'; onClick?: () => void }) {
  const color = tone === 'bad' ? 'var(--color-status-bad)' : tone === 'warn' ? 'var(--color-status-warn)' : 'var(--color-ink-900)';
  const body = (
    <>
      <p className="text-[11px] uppercase" style={{ color: 'var(--color-ink-600)', letterSpacing: '0.04em' }}>
        {label}
      </p>
      <p className="mt-0.5 text-lg font-semibold data-num" style={{ color }}>
        {value}
      </p>
      {hint && (
        <p className="mt-0.5 text-xs" style={{ color: 'var(--color-ink-600)' }}>
          {hint}
        </p>
      )}
    </>
  );
  const cls = 'rounded-lg border p-3 text-left';
  const style = { borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' };
  return onClick ? (
    <button type="button" onClick={onClick} className={`${cls} transition-colors hover:bg-[var(--color-bg)]`} style={style}>
      {body}
    </button>
  ) : (
    <div className={cls} style={style}>
      {body}
    </div>
  );
}

export default function InventoryPage() {
  const [tab, setTab] = useState<TabKey>('levels');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [receiveFor, setReceiveFor] = useState<Product | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [stock, setStock] = useState<StockFilter | ''>('');
  const [stockRefresh, setStockRefresh] = useState(0);
  const [summary, setSummary] = useState<InventorySummary | null>(null);
  const [summaryTick, setSummaryTick] = useState(0);
  const [receiptSearch, setReceiptSearch] = useState('');
  const [kind, setKind] = useState<ReceiptKind | ''>('');
  const { canViewCost, user } = useAuth();
  const showCost = canViewCost();
  const isAdmin = user?.role === 'ADMIN';
  const router = useRouter();

  // The dashboard links here with ?filter=low.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('filter') === 'low') setStock('restock');
  }, []);

  // The header numbers. If they can't load, the page still works without them.
  useEffect(() => {
    let live = true;
    inventoryApi
      .summary()
      .then((s) => live && setSummary(s))
      .catch(() => live && setSummary(null));
    return () => {
      live = false;
    };
  }, [summaryTick]);

  const debouncedReceiptSearch = useDebounced(receiptSearch);
  const {
    items: receipts,
    hasMore,
    loadingMore,
    error: receiptsError,
    loadMore,
    reload: reloadReceipts,
  } = usePagedList((offset, limit) => inventoryApi.receipts({ search: debouncedReceiptSearch || undefined, kind: kind || undefined, offset, limit }), [debouncedReceiptSearch, kind]);

  const suppliers = [...new Set((receipts ?? []).map((r) => r.supplier).filter((s) => !SYSTEM_SUPPLIERS.has(s)))].sort((a, b) => a.localeCompare(b));

  function stockChanged() {
    setSummaryTick((t) => t + 1);
    setStockRefresh((k) => k + 1);
    void reloadReceipts();
  }

  function showStock(filter: StockFilter | '') {
    setStock(filter);
    setTab('levels');
  }

  function onTabKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const i = TABS.findIndex((t) => t.key === tab);
    const next = TABS[(i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length];
    setTab(next.key);
    document.getElementById(`inventory-tab-${next.key}`)?.focus();
  }

  const colSpan = showCost ? 5 : 4;
  const receiptsFiltered = !!(receiptSearch || kind);
  const emptyReceipts = (
    <>
      <Boxes size={28} strokeWidth={1.5} className="mx-auto mb-2" style={{ color: 'var(--color-ink-600)' }} />
      <p className="text-sm font-medium" style={{ color: 'var(--color-ink-900)' }}>
        {receiptsFiltered ? 'No receipts match' : 'No inventory receipts yet'}
      </p>
      <p className="mt-1 text-sm" style={{ color: 'var(--color-ink-600)' }}>
        {receiptsFiltered ? 'Try a different search, or show all receipts.' : 'Receive your first stock delivery to start tracking quantities and acquisition costs.'}
      </p>
      {receiptsFiltered ? (
        <button
          type="button"
          onClick={() => {
            setReceiptSearch('');
            setKind('');
          }}
          className="mt-3 min-h-10 rounded-md border px-3 text-sm font-medium"
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-ink-900)' }}
        >
          Clear filters
        </button>
      ) : (
        <button type="button" onClick={() => setReceiveOpen(true)} className="mt-3 min-h-10 rounded-md px-3 text-sm font-medium text-white" style={{ backgroundColor: 'var(--color-accent)' }}>
          Receive inventory
        </button>
      )}
    </>
  );

  const lineTotal = (r: InventoryReceipt) => r.batches.reduce((sum, b) => sum + b.quantityReceived * b.unitCost, 0);
  const totalText = (r: InventoryReceipt) => (lineTotal(r) > 0 ? `KSh ${fmtNumber(lineTotal(r))}` : '—');

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight" style={{ color: 'var(--color-ink-900)' }}>
            Inventory
          </h1>
          <p className="mt-0.5 text-sm" style={{ color: 'var(--color-ink-600)' }}>
            Stock receipts and acquisition cost — feeds FIFO costing automatically.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setReceiveFor(null);
            setReceiveOpen(true);
          }}
          className="flex min-h-10 items-center gap-1.5 rounded-md px-3.5 text-sm font-medium text-white"
          style={{ backgroundColor: 'var(--color-accent)' }}
        >
          <Plus size={15} strokeWidth={2} />
          Receive inventory
        </button>
      </div>

      {summary && (
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <SummaryCard label="Products" value={fmtNumber(summary.productCount)} hint={`${fmtNumber(summary.inStockCount)} in stock`} onClick={() => showStock('')} />
          <SummaryCard
            label="Needs restock"
            value={fmtNumber(summary.lowCount + summary.outCount)}
            hint={`${fmtNumber(summary.outCount)} out · ${fmtNumber(summary.lowCount)} low`}
            tone={summary.lowCount + summary.outCount > 0 ? 'warn' : 'default'}
            onClick={() => showStock('restock')}
          />
          {summary.costValue !== null && (
            <SummaryCard
              label="Stock value at cost"
              value={`KSh ${fmtNumber(summary.costValue)}`}
              hint={summary.uncostedProducts ? `${fmtNumber(summary.uncostedProducts)} product${summary.uncostedProducts === 1 ? '' : 's'} with no cost on record` : 'FIFO lots still on the shelf'}
              tone={summary.uncostedProducts ? 'warn' : 'default'}
            />
          )}
          <SummaryCard label="Stock value at retail" value={`KSh ${fmtNumber(summary.retailValue)}`} hint="On hand × selling price" />
        </div>
      )}

      <div role="tablist" aria-label="Inventory views" onKeyDown={onTabKeyDown} className="mt-4 flex gap-1.5">
        {TABS.map((t) => {
          const active = tab === t.key;
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              id={`inventory-tab-${t.key}`}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls={`inventory-panel-${t.key}`}
              tabIndex={active ? 0 : -1}
              onClick={() => setTab(t.key)}
              className="flex min-h-10 items-center gap-1.5 rounded-md border px-3 text-sm font-medium"
              style={{
                borderColor: active ? 'var(--color-accent)' : 'var(--color-border)',
                backgroundColor: active ? 'var(--color-accent-soft)' : 'transparent',
                color: active ? 'var(--color-accent)' : 'var(--color-ink-600)',
              }}
            >
              <Icon size={14} strokeWidth={2} />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'levels' && (
        <div role="tabpanel" id="inventory-panel-levels" aria-labelledby="inventory-tab-levels" className="mt-4">
          <StockLevelsTable
            onOpenProduct={setDetailId}
            onReceive={(p) => {
              setReceiveFor(p);
              setReceiveOpen(true);
            }}
            stock={stock}
            onStockChange={setStock}
            refreshKey={stockRefresh}
            onChanged={() => {
              setSummaryTick((t) => t + 1);
              void reloadReceipts();
            }}
          />
        </div>
      )}

      {tab === 'receipts' && (
        <div role="tabpanel" id="inventory-panel-receipts" aria-labelledby="inventory-tab-receipts" className="mt-4">
          <div className="flex flex-wrap gap-2">
            <div className="relative min-w-[240px] flex-1">
              <Search size={15} strokeWidth={2} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-ink-600)' }} />
              <input
                type="search"
                aria-label="Search receipts"
                value={receiptSearch}
                onChange={(e) => setReceiptSearch(e.target.value)}
                placeholder="Supplier, reference or product…"
                className="w-full rounded-md border py-2 pl-8 pr-9 text-sm outline-none focus:border-[var(--color-accent)] [&::-webkit-search-cancel-button]:hidden"
                style={inputStyle}
              />
              {receiptSearch && (
                <button type="button" aria-label="Clear search" onClick={() => setReceiptSearch('')} className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md" style={{ color: 'var(--color-ink-600)' }}>
                  <X size={14} strokeWidth={2} />
                </button>
              )}
            </div>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter receipts">
            {KINDS.map((k) => (
              <button
                key={k.value || 'all'}
                type="button"
                aria-pressed={kind === k.value}
                onClick={() => setKind(k.value)}
                className="min-h-8 rounded-full border px-3 text-xs font-medium"
                style={{
                  borderColor: kind === k.value ? 'var(--color-accent)' : 'var(--color-border)',
                  backgroundColor: kind === k.value ? 'var(--color-accent-soft)' : 'transparent',
                  color: kind === k.value ? 'var(--color-accent)' : 'var(--color-ink-600)',
                }}
              >
                {k.label}
              </button>
            ))}
            {receipts && receipts.length > 0 && (
              <span className="ml-auto text-xs" aria-live="polite" style={{ color: 'var(--color-ink-600)' }}>
                Showing {receipts.length}
                {hasMore ? '+' : ''}
              </span>
            )}
          </div>

          <div className="mt-4 overflow-hidden rounded-lg border" style={{ borderColor: 'var(--color-border)' }}>
            {/* Desktop/tablet table */}
            <table className="hidden w-full text-sm md:table">
              <thead>
                <tr className="border-b text-left" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)' }}>
                  <th scope="col" className="px-4 py-2.5 font-medium" style={{ color: 'var(--color-ink-600)' }}>Date</th>
                  <th scope="col" className="px-4 py-2.5 font-medium" style={{ color: 'var(--color-ink-600)' }}>Supplier</th>
                  <th scope="col" className="px-4 py-2.5 font-medium" style={{ color: 'var(--color-ink-600)' }}>Reference</th>
                  <th scope="col" className="px-4 py-2.5 font-medium" style={{ color: 'var(--color-ink-600)' }}>Received by</th>
                  {showCost && (
                    <th scope="col" className="px-4 py-2.5 text-right font-medium" style={{ color: 'var(--color-ink-600)' }}>Total value</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {receipts === null &&
                  [...Array(4)].map((_, i) => (
                    <tr key={i} className="border-b" style={{ borderColor: 'var(--color-border)' }}>
                      <td className="px-4 py-3" colSpan={colSpan}>
                        <div className="h-4 w-2/3 animate-pulse rounded" style={{ backgroundColor: 'var(--color-border)' }} />
                      </td>
                    </tr>
                  ))}

                {receipts?.length === 0 && (
                  <tr>
                    <td colSpan={colSpan} className="px-4 py-12 text-center">
                      {emptyReceipts}
                    </td>
                  </tr>
                )}

                {receipts?.map((r) => {
                  const isOpen = expanded === r.id;
                  const toggle = () => setExpanded(isOpen ? null : r.id);
                  return (
                    <Fragment key={r.id}>
                      <tr onClick={toggle} onKeyDown={activateOnKey(toggle)} tabIndex={0} aria-expanded={isOpen} className="cursor-pointer border-b transition-colors hover:bg-[var(--color-bg)] focus-visible:bg-[var(--color-bg)]" style={{ borderColor: 'var(--color-border)' }}>
                        <td className="px-4 py-3" style={{ color: 'var(--color-ink-900)' }}>{fmtDate(r.receivedAt)}</td>
                        <td className="px-4 py-3 font-medium" style={{ color: 'var(--color-ink-900)' }}>{r.supplier}</td>
                        <td className="px-4 py-3" style={{ color: 'var(--color-ink-600)' }}>{r.reference ?? '—'}</td>
                        <td className="px-4 py-3" style={{ color: 'var(--color-ink-600)' }}>{r.receivedBy.name}</td>
                        {showCost && (
                          <td className="px-4 py-3 text-right font-medium data-num" style={{ color: 'var(--color-ink-900)' }}>{totalText(r)}</td>
                        )}
                      </tr>
                      {isOpen && (
                        <tr style={{ backgroundColor: 'var(--color-bg)' }}>
                          <td colSpan={colSpan} className="px-4 py-3">
                            <div className="flex flex-col gap-1.5">
                              {r.notes && (
                                <p className="text-xs" style={{ color: 'var(--color-ink-600)' }}>
                                  Note: {r.notes}
                                </p>
                              )}
                              {r.batches.map((b) => (
                                <div key={b.id} className="flex items-center justify-between text-xs">
                                  <span style={{ color: 'var(--color-ink-900)' }}>{b.product.displayName ?? b.product.name}</span>
                                  <span className="data-num" style={{ color: 'var(--color-ink-600)' }}>
                                    {showCost && b.unitCost > 0 ? `${b.quantityReceived} × KSh ${fmtNumber(b.unitCost)}` : `${b.quantityReceived} received`}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>

            {/* Mobile: stacked cards, tap to expand line items (brief §63) */}
            <div className="divide-y divide-[var(--color-border)] md:hidden">
              {receipts === null &&
                [...Array(3)].map((_, i) => (
                  <div key={i} className="p-4">
                    <div className="h-4 w-2/3 animate-pulse rounded" style={{ backgroundColor: 'var(--color-border)' }} />
                  </div>
                ))}

              {receipts?.length === 0 && <div className="px-4 py-12 text-center">{emptyReceipts}</div>}

              {receipts?.map((r) => {
                const isOpen = expanded === r.id;
                return (
                  <div key={r.id}>
                    <button type="button" aria-expanded={isOpen} onClick={() => setExpanded(isOpen ? null : r.id)} className="flex min-h-11 w-full flex-col gap-1 p-4 text-left transition-colors active:bg-[var(--color-bg)]">
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-medium" style={{ color: 'var(--color-ink-900)' }}>{r.supplier}</p>
                        {showCost && (
                          <p className="shrink-0 font-medium data-num" style={{ color: 'var(--color-ink-900)' }}>{totalText(r)}</p>
                        )}
                      </div>
                      <p className="text-sm" style={{ color: 'var(--color-ink-600)' }}>
                        {fmtDate(r.receivedAt)} {r.reference ? `· ${r.reference}` : ''} · {r.receivedBy.name}
                      </p>
                    </button>
                    {isOpen && (
                      <div className="flex flex-col gap-1.5 px-4 pb-4" style={{ backgroundColor: 'var(--color-bg)' }}>
                        {r.notes && (
                          <p className="pt-2 text-xs" style={{ color: 'var(--color-ink-600)' }}>
                            Note: {r.notes}
                          </p>
                        )}
                        {r.batches.map((b) => (
                          <div key={b.id} className="flex items-center justify-between pt-2 text-xs">
                            <span style={{ color: 'var(--color-ink-900)' }}>{b.product.displayName ?? b.product.name}</span>
                            <span className="data-num" style={{ color: 'var(--color-ink-600)' }}>
                              {showCost && b.unitCost > 0 ? `${b.quantityReceived} × KSh ${fmtNumber(b.unitCost)}` : `${b.quantityReceived} received`}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <ListFooter hasMore={hasMore} loadingMore={loadingMore} error={receiptsError} onMore={loadMore} onRetry={reloadReceipts} />
          </div>
        </div>
      )}

      <ProductDetailDrawer
        productId={detailId}
        refreshKey={stockRefresh}
        onClose={() => setDetailId(null)}
        onEdit={isAdmin ? (p) => router.push(`/products?edit=${p.id}`) : undefined}
        onReceive={(p) => {
          setReceiveFor(p);
          setReceiveOpen(true);
        }}
        onChanged={stockChanged}
      />
      <ReceiveInventoryDrawer
        open={receiveOpen}
        initialProduct={receiveFor}
        suppliers={suppliers}
        onClose={() => {
          setReceiveOpen(false);
          setReceiveFor(null);
        }}
        onDone={() => {
          setReceiveOpen(false);
          setReceiveFor(null);
          stockChanged();
        }}
      />
    </div>
  );
}
