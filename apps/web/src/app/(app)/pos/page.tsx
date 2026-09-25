'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Maximize2,
  Minimize2,
  Minus,
  PauseCircle,
  Plus,
  RotateCcw,
  Search,
  ShoppingCart,
  Trash2,
  Truck,
  X,
} from 'lucide-react';
import { productsApi, type Category, type Product } from '../../../lib/products-api';
import { customersApi, type Customer } from '../../../lib/customers-api';
import {
  POS_PAYMENT_METHODS,
  posApi,
  readStockShortfalls,
  type PosPaymentMethod,
  type PosSaleResult,
  type StockShortfall,
  type SuspendedOrder,
} from '../../../lib/pos-api';
import { documentsApi } from '../../../lib/documents-api';
import { thicknessLabel } from '../../../lib/shape-config';
import { TransportDialog, type TransportSettings } from '../../../components/pos/TransportDialog';
import { ReceiptDialog } from '../../../components/pos/ReceiptDialog';
import { ProductIcon } from '../../../components/pos/ProductIcon';
import { SuspendOrderDialog, SuspendedOrdersDialog } from '../../../components/pos/SuspendedOrders';
import { ReturnDialog } from '../../../components/pos/ReturnDialog';
import { StockShortfallDialog } from '../../../components/documents/StockShortfallDialog';
import { DeliveryLocationDialog } from '../../../components/documents/DeliveryLocationDialog';
import { ApiError } from '../../../lib/api';
import { useAuth } from '../../../lib/auth-context';
import { CommittedNumberInput } from '../../../components/ui/inputs';
import { money } from '../../../lib/format';

interface CartLine {
  product: Product;
  qty: number;
  unitPrice: number;
}

const inputStyle = { borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-ink-900)' };


export default function PosPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [highlighted, setHighlighted] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);

  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [browseProducts, setBrowseProducts] = useState<Product[]>([]);

  const [cart, setCart] = useState<CartLine[]>([]);
  const [transport, setTransport] = useState<TransportSettings | null>(null);
  const [transportOpen, setTransportOpen] = useState(false);
  // Set when the cart came from a held order, so completing the sale clears it.
  const [resumedFromId, setResumedFromId] = useState<string | null>(null);

  const [customerMode, setCustomerMode] = useState<'walkin' | 'existing'>('walkin');
  const [walkinName, setWalkinName] = useState('');
  const [customerQuery, setCustomerQuery] = useState('');
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // M-Pesa Paybill is how most of the counter pays, so it leads.
  const [paymentMethod, setPaymentMethod] = useState<PosPaymentMethod>('MPESA');
  // PAVA's only credit: the customer takes the goods and settles the same day.
  // The sale goes out as an unpaid invoice and is closed off from Invoices.
  const [settleLater, setSettleLater] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [shortfalls, setShortfalls] = useState<StockShortfall[] | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<PosSaleResult | null>(null);
  const [deliveryNoteBusy, setDeliveryNoteBusy] = useState(false);
  const [askingDeliveryLocation, setAskingDeliveryLocation] = useState(false);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);

  const [focusMode, setFocusMode] = useState(false);
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [heldOpen, setHeldOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [heldCount, setHeldCount] = useState(0);

  const { user } = useAuth();
  const canOverrideStock = user?.role === 'ADMIN' || !!user?.canInvoiceWithoutStock;

  // Focus mode hides the app topbar (via the data-pos-focus attribute on
  // <html>) AND requests real browser fullscreen — the button was
  // previously only doing the former while claiming to be "Full-screen
  // POS". The attribute is always cleaned up on the way out, so leaving
  // POS can never strand the rest of the app without its navigation.
  useEffect(() => {
    const root = document.documentElement;
    if (focusMode) root.dataset.posFocus = 'on';
    else delete root.dataset.posFocus;
    return () => {
      delete root.dataset.posFocus;
    };
  }, [focusMode]);

  useEffect(() => {
    if (!focusMode) return;
    // Fullscreen requires a user gesture and can be refused (some mobile
    // Safari versions, embedded webviews) — the topbar-hiding CSS above
    // still applies either way, so a refusal just means the till doesn't
    // also take over the OS chrome.
    document.documentElement.requestFullscreen?.().catch(() => {});
  }, [focusMode]);

  // The browser's own Esc-to-exit (or swipe-down on mobile) leaves
  // fullscreen without going through our button — this keeps focusMode
  // (and the Minimize2/Maximize2 icon) truthful when that happens.
  useEffect(() => {
    function onFullscreenChange() {
      if (!document.fullscreenElement) setFocusMode(false);
    }
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  function toggleFocusMode() {
    setFocusMode((v) => {
      const next = !v;
      if (!next && document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
      return next;
    });
  }

  const refreshHeldCount = useCallback(() => {
    posApi
      .suspended()
      .then((list) => setHeldCount(list.length))
      .catch(() => setHeldCount(0));
  }, []);

  useEffect(() => {
    productsApi.categories().then(setCategories);
    refreshHeldCount();
  }, [refreshHeldCount]);

  useEffect(() => {
    // `stale` drops a slow response that arrives after a newer request was made —
    // otherwise tapping through categories quickly can end on the wrong list.
    let stale = false;
    productsApi.list({ categoryId: activeCategory || undefined }).then((r) => {
      if (!stale) setBrowseProducts(r.slice(0, 60));
    });
    return () => {
      stale = true;
    };
  }, [activeCategory]);

  useEffect(() => {
    if (query.trim().length < 1) {
      setResults([]);
      setHighlighted(0);
      return;
    }
    let stale = false;
    const t = setTimeout(() => {
      productsApi.list({ search: query }).then((r) => {
        if (stale) return;
        setResults(r.slice(0, 24));
        setHighlighted(0);
      });
    }, 250);
    return () => {
      stale = true;
      clearTimeout(t);
    };
  }, [query]);

  useEffect(() => {
    if (customerMode !== 'existing' || customerQuery.trim().length < 1) {
      setCustomerResults([]);
      return;
    }
    let stale = false;
    const t = setTimeout(() => {
      customersApi.list(customerQuery).then((r) => {
        if (!stale) setCustomerResults(r.slice(0, 8));
      });
    }, 250);
    return () => {
      stale = true;
      clearTimeout(t);
    };
  }, [customerQuery, customerMode]);

  // "/" jumps back to the search box from anywhere on the till — the fastest
  // path back to adding the next item without reaching for the mouse.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== '/' || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      e.preventDefault();
      searchRef.current?.focus();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const visibleProducts = query.trim().length > 0 ? results : browseProducts;

  function addToCart(p: Product) {
    setError(null);
    setCart((prev) => {
      const existing = prev.find((l) => l.product.id === p.id);
      if (existing) return prev.map((l) => (l.product.id === p.id ? { ...l, qty: l.qty + 1 } : l));
      return [...prev, { product: p, qty: 1, unitPrice: p.basePrice }];
    });
  }

  function handleSearchKeyDown(e: React.KeyboardEvent) {
    if (visibleProducts.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, visibleProducts.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const chosen = visibleProducts[highlighted];
      if (chosen) {
        addToCart(chosen);
        setQuery('');
        setResults([]);
        setHighlighted(0);
        searchRef.current?.focus();
      }
    }
  }

  function updateLine(productId: string, patch: Partial<CartLine>) {
    setCart((prev) => prev.map((l) => (l.product.id === productId ? { ...l, ...patch } : l)));
  }

  function removeLine(productId: string) {
    setCart((prev) => prev.filter((l) => l.product.id !== productId));
    setTransport((t) => (t ? { ...t, applyTo: t.applyTo.filter((id) => id !== productId) } : t));
  }

  function clearCounter() {
    setCart([]);
    setTransport(null);
    setSelectedCustomer(null);
    setWalkinName('');
    setCustomerMode('walkin');
    setResumedFromId(null);
    setMobileCartOpen(false);
    setShortfalls(null);
    setSettleLater(false);
  }

  const subtotal = cart.reduce((s, l) => s + l.qty * l.unitPrice, 0);
  const transportAmount = transport?.amount || 0;
  // Approximate — the server computes the precise, correctly-rounded total.
  const estimatedTotal = subtotal + transportAmount;
  const shortLines = useMemo(() => cart.filter((l) => l.product.stockQuantity < l.qty), [cart]);

  async function checkout(opts?: { allowNegativeStock?: boolean }) {
    if (cart.length === 0) return;
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      const sale = await posApi.checkout({
        customerId: customerMode === 'existing' ? selectedCustomer?.id : undefined,
        customerName: customerMode === 'walkin' ? walkinName || undefined : undefined,
        items: cart.map((l) => ({ productId: l.product.id, qty: l.qty, unitPrice: l.unitPrice })),
        transportAmount: transport?.amount || undefined,
        transportAllocation: transport?.allocation,
        transportApplyTo: transport?.applyTo,
        manualAllocations:
          transport?.allocation === 'MANUAL'
            ? Object.entries(transport.manualAllocations).map(([productId, amount]) => ({ productId, amount }))
            : undefined,
        foldTransportIntoPrices: transport?.fold ?? true,
        paymentMethod: settleLater ? undefined : paymentMethod,
        settleLater: settleLater || undefined,
        allowNegativeStock: opts?.allowNegativeStock,
        suspendedFromId: resumedFromId ?? undefined,
      });
      setReceipt(sale);
      clearCounter();
      refreshHeldCount();
    } catch (err) {
      // Short stock is a decision, not an error banner: the dialog states the
      // numbers and lets an authorized operator continue as a backorder.
      const detected = err instanceof ApiError ? readStockShortfalls(err.details) : null;
      if (detected) setShortfalls(detected);
      else setError(err instanceof ApiError ? err.message : 'Could not complete this sale.');
    } finally {
      setSubmitting(false);
    }
  }

  async function suspendCurrent(label: string) {
    setSubmitting(true);
    setError(null);
    try {
      await posApi.suspend({
        customerId: customerMode === 'existing' ? selectedCustomer?.id : undefined,
        customerName: customerMode === 'walkin' ? walkinName || undefined : undefined,
        label: label || undefined,
        items: cart.map((l) => ({ productId: l.product.id, qty: l.qty, unitPrice: l.unitPrice })),
        transportAmount: transport?.amount || undefined,
        foldTransportIntoPrices: transport?.fold ?? true,
      });
      // A resumed order that is suspended again is re-parked as a new hold.
      if (resumedFromId) await posApi.discardSuspended(resumedFromId).catch(() => {});
      clearCounter();
      setSuspendOpen(false);
      setNotice('Order suspended.');
      refreshHeldCount();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not suspend this order.');
      setSuspendOpen(false);
    } finally {
      setSubmitting(false);
    }
  }

  function resumeOrder(order: SuspendedOrder) {
    setCart(
      order.items
        .filter((i) => i.product)
        .map((i) => ({ product: i.product as Product, qty: i.qty, unitPrice: i.unitPrice })),
    );
    setTransport(
      order.transportAmount > 0
        ? {
            amount: order.transportAmount,
            allocation: 'QUANTITY',
            applyTo: order.items.map((i) => i.productId).filter((id): id is string => !!id),
            manualAllocations: {},
            fold: order.transportMode !== 'ITEMIZED',
          }
        : null,
    );
    if (order.customer) {
      setCustomerMode('existing');
      // The held order carries only the identifying fields of the customer;
      // that is all the checkout needs (it posts the id).
      setSelectedCustomer(order.customer as unknown as Customer);
    } else {
      setCustomerMode('walkin');
      setWalkinName(order.customerName ?? '');
    }
    setResumedFromId(order.id);
    setHeldOpen(false);
    setNotice('Order resumed.');
    refreshHeldCount();
  }

  async function createDeliveryNote(deliveryLocation: string, deliveryPhone: string) {
    if (!receipt) return;
    setDeliveryNoteBusy(true);
    try {
      const note = await documentsApi.createDeliveryNote(receipt.id, deliveryLocation || undefined, deliveryPhone || undefined);
      setAskingDeliveryLocation(false);
      setReceipt(null);
      setNotice(`Delivery note ${note.deliveryNoteNumber ?? ''} created — open it under Invoices › Delivery notes to print.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create a delivery note.');
    } finally {
      setDeliveryNoteBusy(false);
    }
  }

  const cartContent = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: 'var(--color-border)' }}>
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold" style={{ color: 'var(--color-ink-900)' }}>
            Current sale
          </p>
          {cart.length > 0 && (
            <span className="data-num rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: 'var(--color-accent-soft)', color: 'var(--color-accent)' }}>
              {cart.length}
            </span>
          )}
          {resumedFromId && (
            <span className="rounded px-1.5 py-0.5 text-[11px] font-medium" style={{ backgroundColor: 'var(--color-status-warnSoft)', color: 'var(--color-status-warn)' }}>
              Resumed
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {cart.length > 0 && (
            <button
              type="button"
              onClick={() => setSuspendOpen(true)}
              title="Suspend this order"
              aria-label="Suspend this order"
              className="flex h-9 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-ink-900)' }}
            >
              <PauseCircle size={14} strokeWidth={2} />
              Hold
            </button>
          )}
          <button type="button" onClick={() => setMobileCartOpen(false)} aria-label="Close cart" className="flex h-9 w-9 items-center justify-center rounded-md lg:hidden" style={{ color: 'var(--color-ink-600)' }}>
            <X size={17} strokeWidth={2} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-2">
        {cart.length === 0 && (
          <div className="py-12 text-center">
            <ShoppingCart size={26} strokeWidth={1.5} className="mx-auto mb-2" style={{ color: 'var(--color-ink-600)' }} />
            <p className="text-sm" style={{ color: 'var(--color-ink-600)' }}>
              Search or tap a product to add it.
            </p>
          </div>
        )}
        <div className="flex flex-col">
          {cart.map((l) => {
            const short = l.product.stockQuantity < l.qty;
            return (
              <div key={l.product.id} className="flex gap-3 border-b py-3 last:border-b-0" style={{ borderColor: 'var(--color-border)' }}>
                <ProductIcon product={l.product} size={40} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium" style={{ color: 'var(--color-ink-900)' }}>
                        {l.product.displayName ?? l.product.name}
                      </p>
                      <p className="truncate text-xs" style={{ color: short ? 'var(--color-status-warn)' : 'var(--color-ink-600)' }}>
                        {short ? `Only ${l.product.stockQuantity} ${l.product.unit.symbol} in stock` : `${l.product.stockQuantity} ${l.product.unit.symbol} in stock`}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeLine(l.product.id)}
                      aria-label="Remove line"
                      title="Remove line"
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md"
                      style={{ color: 'var(--color-status-bad)' }}
                    >
                      <Trash2 size={15} strokeWidth={2} />
                    </button>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <div className="flex items-center rounded-md border" style={{ borderColor: 'var(--color-border)' }}>
                      <button type="button" aria-label="Less" onClick={() => updateLine(l.product.id, { qty: Math.max(1, l.qty - 1) })} className="flex h-10 w-10 items-center justify-center" style={{ color: 'var(--color-ink-600)' }}>
                        <Minus size={14} strokeWidth={2} />
                      </button>
                      <CommittedNumberInput
                        aria-label="Quantity"
                        min={1}
                        value={l.qty}
                        onCommit={(n) => updateLine(l.product.id, { qty: n })}
                        className="data-num w-12 border-0 bg-transparent text-center text-sm outline-none"
                        style={{ color: 'var(--color-ink-900)' }}
                      />
                      <button type="button" aria-label="More" onClick={() => updateLine(l.product.id, { qty: l.qty + 1 })} className="flex h-10 w-10 items-center justify-center" style={{ color: 'var(--color-ink-600)' }}>
                        <Plus size={14} strokeWidth={2} />
                      </button>
                    </div>
                    <CommittedNumberInput
                      aria-label="Unit price"
                      min={0}
                      value={l.unitPrice}
                      onCommit={(n) => updateLine(l.product.id, { unitPrice: n })}
                      className="data-num min-h-10 w-24 rounded-md border px-2 text-sm"
                      style={inputStyle}
                    />
                    <p className="data-num ml-auto text-sm font-semibold" style={{ color: 'var(--color-ink-900)' }}>
                      {money(l.qty * l.unitPrice)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t px-4 py-3" style={{ borderColor: 'var(--color-border)', paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
        <div>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => setCustomerMode('walkin')}
              className="min-h-10 flex-1 rounded-md border px-2 text-xs font-medium"
              style={{ borderColor: customerMode === 'walkin' ? 'var(--color-accent)' : 'var(--color-border)', color: customerMode === 'walkin' ? 'var(--color-accent)' : 'var(--color-ink-600)' }}
            >
              Walk-in
            </button>
            <button
              type="button"
              onClick={() => setCustomerMode('existing')}
              className="min-h-10 flex-1 rounded-md border px-2 text-xs font-medium"
              style={{ borderColor: customerMode === 'existing' ? 'var(--color-accent)' : 'var(--color-border)', color: customerMode === 'existing' ? 'var(--color-accent)' : 'var(--color-ink-600)' }}
            >
              Existing customer
            </button>
          </div>
          {customerMode === 'walkin' ? (
            <input value={walkinName} onChange={(e) => setWalkinName(e.target.value)} placeholder="Customer name (optional)" className="mt-2 min-h-10 w-full rounded-md border px-3 text-sm" style={inputStyle} />
          ) : (
            <div className="relative mt-2">
              {selectedCustomer ? (
                <div className="flex min-h-10 items-center justify-between rounded-md border px-3 text-sm" style={inputStyle}>
                  <span className="truncate">{selectedCustomer.businessName || selectedCustomer.name}</span>
                  <button type="button" onClick={() => setSelectedCustomer(null)} aria-label="Clear customer" style={{ color: 'var(--color-ink-600)' }}>
                    <X size={14} strokeWidth={2} />
                  </button>
                </div>
              ) : (
                <>
                  <input value={customerQuery} onChange={(e) => setCustomerQuery(e.target.value)} placeholder="Search customers…" className="min-h-10 w-full rounded-md border px-3 text-sm" style={inputStyle} />
                  {customerResults.length > 0 && (
                    <div className="absolute left-0 right-0 bottom-full z-10 mb-1 max-h-44 overflow-y-auto rounded-md border" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
                      {customerResults.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setSelectedCustomer(c);
                            setCustomerQuery('');
                            setCustomerResults([]);
                          }}
                          className="block w-full px-3 py-2.5 text-left text-sm hover:bg-[var(--color-bg)]"
                          style={{ color: 'var(--color-ink-900)' }}
                        >
                          {c.businessName || c.name}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setTransportOpen(true)}
          className="flex min-h-10 items-center justify-between rounded-md border px-3 text-sm"
          style={{ borderColor: 'var(--color-border)', color: transport ? 'var(--color-accent)' : 'var(--color-ink-600)' }}
        >
          <span className="flex items-center gap-1.5">
            <Truck size={14} strokeWidth={2} />
            Transport
          </span>
          <span className="data-num">{transport ? money(transport.amount) : '+ Add'}</span>
        </button>

        <div className="grid grid-cols-2 gap-2">
          {POS_PAYMENT_METHODS.map((m) => {
            const active = !settleLater && paymentMethod === m.value;
            return (
              <button
                key={m.value}
                type="button"
                onClick={() => {
                  setPaymentMethod(m.value);
                  setSettleLater(false);
                }}
                className="min-h-11 rounded-md border px-2 text-sm font-medium"
                style={{
                  borderColor: active ? 'var(--color-accent)' : 'var(--color-border)',
                  backgroundColor: active ? 'var(--color-accent-soft)' : 'transparent',
                  color: active ? 'var(--color-accent)' : 'var(--color-ink-600)',
                }}
              >
                {m.label}
                <span className="ml-1 text-[11px] font-normal opacity-70">{m.hint}</span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => setSettleLater((v) => !v)}
          className="min-h-11 rounded-md border px-3 text-sm font-medium"
          style={{
            borderColor: settleLater ? 'var(--color-status-warn)' : 'var(--color-border)',
            backgroundColor: settleLater ? 'var(--color-status-warnSoft)' : 'transparent',
            color: settleLater ? 'var(--color-status-warn)' : 'var(--color-ink-600)',
          }}
        >
          Pay later today
          <span className="ml-1 text-[11px] font-normal opacity-70">goods out, settle before close</span>
        </button>

        {shortLines.length > 0 && (
          <p className="rounded-md px-3 py-2 text-xs" style={{ backgroundColor: 'var(--color-status-warnSoft)', color: 'var(--color-status-warn)' }}>
            {shortLines.length} line{shortLines.length === 1 ? '' : 's'} above recorded stock.
          </p>
        )}

        {error && (
          <p className="rounded-md px-3 py-2 text-sm" style={{ backgroundColor: 'var(--color-status-badSoft)', color: 'var(--color-status-bad)' }}>
            {error}
          </p>
        )}

        <div className="flex items-baseline justify-between">
          <span className="text-sm" style={{ color: 'var(--color-ink-600)' }}>
            Estimated total
          </span>
          <span className="data-num text-xl font-semibold" style={{ color: 'var(--color-ink-900)' }}>
            {money(Math.max(0, estimatedTotal))}
          </span>
        </div>

        <button
          type="button"
          onClick={() => checkout()}
          disabled={cart.length === 0 || submitting}
          className="min-h-12 rounded-md px-4 text-sm font-semibold text-white disabled:opacity-50"
          style={{ backgroundColor: 'var(--color-accent)' }}
        >
          {submitting ? 'Completing sale…' : `${settleLater ? 'Release goods' : 'Complete sale'} · ${money(Math.max(0, estimatedTotal))}`}
        </button>
      </div>
    </div>
  );

  return (
    <div className={`flex flex-col ${focusMode ? 'h-[100dvh]' : 'h-[calc(100dvh-56px)]'}`}>
      {/* POS mode bar — the way out of the till is always on screen. */}
      <div className="flex shrink-0 items-center justify-between gap-2 border-b px-3 py-2" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
        <Link
          href="/dashboard"
          className="flex min-h-10 items-center gap-1.5 rounded-md border px-2.5 text-sm font-medium"
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-ink-900)' }}
        >
          <ArrowLeft size={15} strokeWidth={2} />
          <span className="hidden sm:inline">Exit POS</span>
        </Link>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setReturnOpen(true)}
            title="Return items from a previous sale"
            className="flex min-h-10 items-center gap-1.5 rounded-md border px-2.5 text-sm font-medium"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-ink-900)' }}
          >
            <RotateCcw size={15} strokeWidth={2} />
            <span className="hidden sm:inline">Returns</span>
          </button>
          <button
            type="button"
            onClick={() => setHeldOpen(true)}
            title="Suspended orders"
            className="relative flex min-h-10 items-center gap-1.5 rounded-md border px-2.5 text-sm font-medium"
            style={{ borderColor: heldCount > 0 ? 'var(--color-accent)' : 'var(--color-border)', color: heldCount > 0 ? 'var(--color-accent)' : 'var(--color-ink-900)' }}
          >
            <PauseCircle size={15} strokeWidth={2} />
            <span className="hidden sm:inline">On hold</span>
            {heldCount > 0 && (
              <span className="data-num rounded-full px-1.5 text-xs font-semibold" style={{ backgroundColor: 'var(--color-accent)', color: '#fff' }}>
                {heldCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={toggleFocusMode}
            aria-label={focusMode ? 'Leave full-screen POS' : 'Full-screen POS'}
            title={focusMode ? 'Leave full-screen POS' : 'Full-screen POS'}
            className="flex h-10 w-10 items-center justify-center rounded-md border"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-ink-600)' }}
          >
            {focusMode ? <Minimize2 size={15} strokeWidth={2} /> : <Maximize2 size={15} strokeWidth={2} />}
          </button>
        </div>
      </div>

      {notice && (
        <button
          type="button"
          onClick={() => setNotice(null)}
          className="shrink-0 px-4 py-2 text-left text-sm"
          style={{ backgroundColor: 'var(--color-status-okSoft)', color: 'var(--color-status-ok)' }}
        >
          {notice}
        </button>
      )}

      <div className="flex min-h-0 flex-1">
        {/* Category rail — tap-to-browse, no typing required. */}
        <div className="hidden w-44 shrink-0 flex-col gap-0.5 overflow-y-auto border-r p-2 xl:flex" style={{ borderColor: 'var(--color-border)' }}>
          <button
            type="button"
            onClick={() => setActiveCategory(null)}
            className="rounded-md px-2.5 py-2 text-left text-sm font-medium"
            style={{ backgroundColor: activeCategory === null ? 'var(--color-accent-soft)' : 'transparent', color: activeCategory === null ? 'var(--color-accent)' : 'var(--color-ink-600)' }}
          >
            All products
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setActiveCategory(c.id)}
              className="truncate rounded-md px-2.5 py-2 text-left text-sm font-medium"
              style={{ backgroundColor: activeCategory === c.id ? 'var(--color-accent-soft)' : 'transparent', color: activeCategory === c.id ? 'var(--color-accent)' : 'var(--color-ink-600)' }}
            >
              {c.name}
            </button>
          ))}
        </div>

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="shrink-0 border-b p-3" style={{ borderColor: 'var(--color-border)' }}>
            <div className="relative">
              <Search size={16} strokeWidth={2} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-ink-600)' }} />
              <input
                ref={searchRef}
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder='Search products — "1.5 inch square pipe". ↑↓ to pick, Enter to add.'
                className="min-h-12 w-full rounded-md border pl-10 pr-3 text-base outline-none focus:border-[var(--color-accent)]"
                style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-ink-900)' }}
              />
            </div>

            {/* Categories collapse to a scrolling strip where the rail is hidden. */}
            <div className="mt-2 flex gap-1.5 overflow-x-auto pb-0.5 xl:hidden">
              <button
                type="button"
                onClick={() => setActiveCategory(null)}
                className="min-h-9 shrink-0 rounded-md border px-3 text-xs font-medium"
                style={{ borderColor: activeCategory === null ? 'var(--color-accent)' : 'var(--color-border)', color: activeCategory === null ? 'var(--color-accent)' : 'var(--color-ink-600)' }}
              >
                All
              </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setActiveCategory(c.id)}
                  className="min-h-9 shrink-0 rounded-md border px-3 text-xs font-medium"
                  style={{ borderColor: activeCategory === c.id ? 'var(--color-accent)' : 'var(--color-border)', color: activeCategory === c.id ? 'var(--color-accent)' : 'var(--color-ink-600)' }}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3" style={{ paddingBottom: cart.length > 0 ? '5rem' : undefined }}>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {visibleProducts.map((p, i) => {
                const gauge = thicknessLabel(p.shape, p.thicknessMm);
                const isHighlighted = query.trim().length > 0 && i === highlighted;
                const outOfStock = p.stockQuantity <= 0;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => addToCart(p)}
                    onMouseEnter={() => query.trim().length > 0 && setHighlighted(i)}
                    className="flex min-h-[7.5rem] flex-col gap-2 rounded-lg border p-3 text-left transition-colors active:scale-[0.99]"
                    style={{
                      borderColor: isHighlighted ? 'var(--color-accent)' : 'var(--color-border)',
                      backgroundColor: isHighlighted ? 'var(--color-accent-soft)' : 'var(--color-surface)',
                    }}
                  >
                    <div className="flex w-full items-start gap-2">
                      <ProductIcon product={p} size={36} />
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-sm font-medium leading-snug" style={{ color: 'var(--color-ink-900)' }}>
                          {p.displayName ?? p.name}
                        </p>
                        <p className="truncate text-xs" style={{ color: 'var(--color-ink-600)' }}>
                          {[p.nominalSize, gauge].filter(Boolean).join(' · ') || p.unit.symbol}
                        </p>
                      </div>
                    </div>
                    <div className="mt-auto flex w-full items-center justify-between gap-2">
                      <span className="data-num text-sm font-semibold" style={{ color: 'var(--color-ink-900)' }}>
                        {money(p.basePrice)}
                      </span>
                      <span
                        className="data-num shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium"
                        style={{
                          backgroundColor: outOfStock ? 'var(--color-status-badSoft)' : 'var(--color-status-okSoft)',
                          color: outOfStock ? 'var(--color-status-bad)' : 'var(--color-status-ok)',
                        }}
                      >
                        {p.stockQuantity} {p.unit.symbol}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
            {query && visibleProducts.length === 0 && (
              <p className="mt-10 text-center text-sm" style={{ color: 'var(--color-ink-600)' }}>
                No products match &ldquo;{query}&rdquo;.
              </p>
            )}
          </div>
        </div>

        {/* Desktop cart — the working surface at a real till. */}
        <div className="hidden w-[26rem] shrink-0 border-l lg:block 2xl:w-[28rem]" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
          {cartContent}
        </div>
      </div>

      {/* Mobile: sticky summary bar -> full-screen cart */}
      {cart.length > 0 && !mobileCartOpen && (
        <button
          type="button"
          onClick={() => setMobileCartOpen(true)}
          className="fixed bottom-0 left-0 right-0 z-30 flex min-h-14 items-center justify-between px-4 text-sm font-semibold text-white lg:hidden"
          style={{ backgroundColor: 'var(--color-accent)', paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
        >
          <span className="flex items-center gap-2">
            <ShoppingCart size={16} strokeWidth={2} />
            {cart.length} item{cart.length > 1 ? 's' : ''}
          </span>
          <span className="data-num">{money(Math.max(0, estimatedTotal))}</span>
        </button>
      )}
      {mobileCartOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" style={{ backgroundColor: 'var(--color-surface)' }}>
          {cartContent}
        </div>
      )}

      {transportOpen && (
        <TransportDialog
          lines={cart.map((l) => ({ product: l.product, qty: l.qty, unitPrice: l.unitPrice, discount: 0 }))}
          initial={transport}
          onClose={() => setTransportOpen(false)}
          onApply={(t) => setTransport(t.amount > 0 ? t : null)}
        />
      )}

      {shortfalls && (
        <StockShortfallDialog
          shortfalls={shortfalls}
          canProceed={canOverrideStock}
          busy={submitting}
          action="sale"
          onCancel={() => setShortfalls(null)}
          onProceed={() => {
            setShortfalls(null);
            checkout({ allowNegativeStock: true });
          }}
        />
      )}

      {suspendOpen && (
        <SuspendOrderDialog
          defaultLabel={customerMode === 'existing' ? selectedCustomer?.businessName || selectedCustomer?.name || '' : walkinName}
          itemCount={cart.length}
          total={Math.max(0, estimatedTotal)}
          busy={submitting}
          onCancel={() => setSuspendOpen(false)}
          onConfirm={suspendCurrent}
        />
      )}

      {heldOpen && <SuspendedOrdersDialog onClose={() => setHeldOpen(false)} onResume={resumeOrder} onChanged={refreshHeldCount} />}

      {returnOpen && (
        <ReturnDialog
          onClose={() => setReturnOpen(false)}
          onCompleted={(result) => setNotice(`Return ${result.returnNumber} recorded — stock restored.`)}
        />
      )}

      {receipt && (
        <ReceiptDialog
          sale={receipt}
          onClose={() => setReceipt(null)}
          onCreateDeliveryNote={() => setAskingDeliveryLocation(true)}
          deliveryNoteBusy={deliveryNoteBusy}
        />
      )}

      {receipt && askingDeliveryLocation && (
        <DeliveryLocationDialog
          busy={deliveryNoteBusy}
          onCancel={() => setAskingDeliveryLocation(false)}
          onConfirm={createDeliveryNote}
        />
      )}
    </div>
  );
}