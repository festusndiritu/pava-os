'use client';

import { useEffect, useRef, useState } from 'react';
import { Minus, Package, Plus, Search, ShoppingCart, Trash2, Truck, X } from 'lucide-react';
import { productsApi, type Category, type Product } from '../../../lib/products-api';
import { customersApi, type Customer } from '../../../lib/customers-api';
import { posApi, type PosPaymentMethod, type PosSaleResult } from '../../../lib/pos-api';
import { thicknessLabel } from '../../../lib/shape-config';
import { resolveImageUrl } from '../../../lib/api';
import { TransportDialog, type TransportSettings } from '../../../components/pos/TransportDialog';
import { ReceiptDialog } from '../../../components/pos/ReceiptDialog';
import { ApiError } from '../../../lib/api';

interface CartLine {
  product: Product;
  qty: number;
  unitPrice: number;
}

const inputStyle = { borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-ink-900)' };

function money(n: number) {
  return `KSh ${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function ProductThumb({ product, size = 44 }: { product: Product; size?: number }) {
  const src = resolveImageUrl(product.imageUrl);
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" width={size} height={size} className="rounded-md object-cover" style={{ width: size, height: size }} />;
  }
  return (
    <div className="flex shrink-0 items-center justify-center rounded-md" style={{ width: size, height: size, backgroundColor: 'var(--color-bg)' }}>
      <Package size={size * 0.45} strokeWidth={1.5} style={{ color: 'var(--color-ink-600)' }} />
    </div>
  );
}

export default function PosPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [highlighted, setHighlighted] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);

  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [browseProducts, setBrowseProducts] = useState<Product[]>([]);

  const [cart, setCart] = useState<CartLine[]>([]);
  const [discount, setDiscount] = useState('');
  const [transport, setTransport] = useState<TransportSettings | null>(null);
  const [transportOpen, setTransportOpen] = useState(false);

  const [customerMode, setCustomerMode] = useState<'walkin' | 'existing'>('walkin');
  const [walkinName, setWalkinName] = useState('');
  const [customerQuery, setCustomerQuery] = useState('');
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const [paymentMethod, setPaymentMethod] = useState<PosPaymentMethod>('CASH');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<PosSaleResult | null>(null);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);

  // Quick-access rail: categories to browse by tap, no typing required.
  useEffect(() => {
    productsApi.categories().then(setCategories);
  }, []);

  useEffect(() => {
    productsApi.list({ categoryId: activeCategory || undefined }).then((r) => setBrowseProducts(r.slice(0, 60)));
  }, [activeCategory]);

  // Live search overrides the category browse view while the user is typing.
  useEffect(() => {
    if (query.trim().length < 1) {
      setResults([]);
      setHighlighted(0);
      return;
    }
    const t = setTimeout(() => {
      productsApi.list({ search: query }).then((r) => {
        setResults(r.slice(0, 20));
        setHighlighted(0);
      });
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (customerMode !== 'existing' || customerQuery.trim().length < 1) {
      setCustomerResults([]);
      return;
    }
    const t = setTimeout(() => {
      customersApi.list(customerQuery).then((r) => setCustomerResults(r.slice(0, 8)));
    }, 250);
    return () => clearTimeout(t);
  }, [customerQuery, customerMode]);

  const visibleProducts = query.trim().length > 0 ? results : browseProducts;

  function addToCart(p: Product) {
    setCart((prev) => {
      const existing = prev.find((l) => l.product.id === p.id);
      if (existing) return prev.map((l) => (l.product.id === p.id ? { ...l, qty: l.qty + 1 } : l));
      return [...prev, { product: p, qty: 1, unitPrice: p.basePrice }];
    });
  }

  // Arrow keys move a highlight through the visible grid, Enter adds it and
  // clears the search so the next scan/type starts fresh — no mouse needed.
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

  const subtotalBeforeDiscount = cart.reduce((s, l) => s + l.qty * l.unitPrice, 0);
  const discountValue = Math.min(Number(discount) || 0, subtotalBeforeDiscount);
  const transportAmount = transport?.amount || 0;
  // Approximate — the server computes the precise, correctly-rounded total; this is just for the cart view.
  const estimatedTotal = subtotalBeforeDiscount - discountValue + transportAmount;

  function distributedDiscounts(): Record<string, number> {
    if (discountValue <= 0 || cart.length === 0) return {};
    const bases = cart.map((l) => l.qty * l.unitPrice);
    const totalBase = bases.reduce((a, b) => a + b, 0) || 1;
    const result: Record<string, number> = {};
    let assigned = 0;
    cart.forEach((l, i) => {
      const isLast = i === cart.length - 1;
      const share = isLast ? discountValue - assigned : Math.round(discountValue * (bases[i] / totalBase) * 100) / 100;
      result[l.product.id] = share;
      assigned += share;
    });
    return result;
  }

  async function checkout() {
    if (cart.length === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const discounts = distributedDiscounts();
      const sale = await posApi.checkout({
        customerId: customerMode === 'existing' ? selectedCustomer?.id : undefined,
        customerName: customerMode === 'walkin' ? walkinName || undefined : undefined,
        items: cart.map((l) => ({ productId: l.product.id, qty: l.qty, unitPrice: l.unitPrice, discount: discounts[l.product.id] || 0 })),
        transportAmount: transport?.amount || undefined,
        transportAllocation: transport?.allocation,
        transportApplyTo: transport?.applyTo,
        manualAllocations: transport?.allocation === 'MANUAL' ? Object.entries(transport.manualAllocations).map(([productId, amount]) => ({ productId, amount })) : undefined,
        foldTransportIntoPrices: transport?.fold ?? true,
        paymentMethod,
      });
      setReceipt(sale);
      setCart([]);
      setDiscount('');
      setTransport(null);
      setSelectedCustomer(null);
      setWalkinName('');
      setMobileCartOpen(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not complete this sale.');
    } finally {
      setSubmitting(false);
    }
  }

  const cartContent = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: 'var(--color-border)' }}>
        <p className="text-base font-semibold" style={{ color: 'var(--color-ink-900)' }}>
          Cart
        </p>
        <button type="button" onClick={() => setMobileCartOpen(false)} className="lg:hidden" style={{ color: 'var(--color-ink-600)' }}>
          <X size={18} strokeWidth={2} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-3">
        {cart.length === 0 && (
          <p className="py-10 text-center text-sm" style={{ color: 'var(--color-ink-600)' }}>
            Search or tap a product to add it.
          </p>
        )}
        <div className="flex flex-col gap-4">
          {cart.map((l) => (
            <div key={l.product.id} className="flex gap-3 border-b pb-4" style={{ borderColor: 'var(--color-border)' }}>
              <ProductThumb product={l.product} size={48} />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate text-sm font-medium" style={{ color: 'var(--color-ink-900)' }}>
                    {l.product.displayName ?? l.product.name}
                  </p>
                  <button type="button" onClick={() => removeLine(l.product.id)} style={{ color: 'var(--color-status-bad)' }}>
                    <Trash2 size={14} strokeWidth={2} />
                  </button>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex items-center rounded-md border" style={{ borderColor: 'var(--color-border)' }}>
                    <button type="button" onClick={() => updateLine(l.product.id, { qty: Math.max(1, l.qty - 1) })} className="flex h-8 w-8 items-center justify-center" style={{ color: 'var(--color-ink-600)' }}>
                      <Minus size={13} strokeWidth={2} />
                    </button>
                    <input
                      type="number"
                      value={l.qty}
                      onChange={(e) => updateLine(l.product.id, { qty: Math.max(0.01, Number(e.target.value) || 0) })}
                      className="w-12 border-0 bg-transparent text-center text-sm data-num outline-none"
                      style={{ color: 'var(--color-ink-900)' }}
                    />
                    <button type="button" onClick={() => updateLine(l.product.id, { qty: l.qty + 1 })} className="flex h-8 w-8 items-center justify-center" style={{ color: 'var(--color-ink-600)' }}>
                      <Plus size={13} strokeWidth={2} />
                    </button>
                  </div>
                  <input
                    type="number"
                    value={l.unitPrice}
                    onChange={(e) => updateLine(l.product.id, { unitPrice: Number(e.target.value) || 0 })}
                    className="w-24 rounded-md border px-2 py-1.5 text-sm data-num"
                    style={inputStyle}
                  />
                  <p className="ml-auto text-sm font-medium data-num" style={{ color: 'var(--color-ink-900)' }}>
                    {money(l.qty * l.unitPrice)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t px-5 py-4" style={{ borderColor: 'var(--color-border)' }}>
        <div>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => setCustomerMode('walkin')}
              className="flex-1 rounded-md border px-2 py-1.5 text-xs font-medium"
              style={{ borderColor: customerMode === 'walkin' ? 'var(--color-accent)' : 'var(--color-border)', color: customerMode === 'walkin' ? 'var(--color-accent)' : 'var(--color-ink-600)' }}
            >
              Walk-in
            </button>
            <button
              type="button"
              onClick={() => setCustomerMode('existing')}
              className="flex-1 rounded-md border px-2 py-1.5 text-xs font-medium"
              style={{ borderColor: customerMode === 'existing' ? 'var(--color-accent)' : 'var(--color-border)', color: customerMode === 'existing' ? 'var(--color-accent)' : 'var(--color-ink-600)' }}
            >
              Existing customer
            </button>
          </div>
          {customerMode === 'walkin' ? (
            <input value={walkinName} onChange={(e) => setWalkinName(e.target.value)} placeholder="Customer name (optional)" className="mt-2 w-full rounded-md border px-3 py-2 text-sm" style={inputStyle} />
          ) : (
            <div className="relative mt-2">
              {selectedCustomer ? (
                <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm" style={inputStyle}>
                  <span>{selectedCustomer.businessName || selectedCustomer.name}</span>
                  <button type="button" onClick={() => setSelectedCustomer(null)} style={{ color: 'var(--color-ink-600)' }}>
                    <X size={14} strokeWidth={2} />
                  </button>
                </div>
              ) : (
                <>
                  <input value={customerQuery} onChange={(e) => setCustomerQuery(e.target.value)} placeholder="Search customers…" className="w-full rounded-md border px-3 py-2 text-sm" style={inputStyle} />
                  {customerResults.length > 0 && (
                    <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-40 overflow-y-auto rounded-md border" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
                      {customerResults.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setSelectedCustomer(c);
                            setCustomerQuery('');
                            setCustomerResults([]);
                          }}
                          className="block w-full px-3 py-2 text-left text-sm hover:bg-[var(--color-bg)]"
                          style={{ color: 'var(--color-ink-900)' }}
                        >
                          {c.businessName || c.name} {c.isCredit ? '· Credit' : ''}
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
          className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
          style={{ borderColor: 'var(--color-border)', color: transport ? 'var(--color-accent)' : 'var(--color-ink-600)' }}
        >
          <span className="flex items-center gap-1.5">
            <Truck size={14} strokeWidth={2} />
            Transport
          </span>
          <span className="data-num">{transport ? money(transport.amount) : '+ Add'}</span>
        </button>

        <div className="flex items-center justify-between text-sm">
          <span style={{ color: 'var(--color-ink-600)' }}>Discount</span>
          <input
            type="number"
            min="0"
            value={discount}
            onChange={(e) => setDiscount(e.target.value)}
            placeholder="0"
            className="w-24 rounded-md border px-2 py-1 text-right text-sm data-num"
            style={inputStyle}
          />
        </div>

        <div className="flex items-center justify-between text-lg font-semibold" style={{ color: 'var(--color-ink-900)' }}>
          <span>Estimated total</span>
          <span className="data-num">{money(Math.max(0, estimatedTotal))}</span>
        </div>

        <div className="grid grid-cols-4 gap-1.5">
          {(['CASH', 'MPESA', 'CARD', 'CREDIT'] as PosPaymentMethod[]).map((m) => (
            <button
              key={m}
              type="button"
              disabled={m === 'CREDIT' && !(customerMode === 'existing' && selectedCustomer?.isCredit)}
              onClick={() => setPaymentMethod(m)}
              className="rounded-md border py-1.5 text-xs font-medium disabled:opacity-40"
              style={{ borderColor: paymentMethod === m ? 'var(--color-accent)' : 'var(--color-border)', color: paymentMethod === m ? 'var(--color-accent)' : 'var(--color-ink-600)' }}
            >
              {m}
            </button>
          ))}
        </div>

        {error && (
          <p className="rounded-md px-3 py-2 text-sm" style={{ backgroundColor: 'var(--color-status-badSoft)', color: 'var(--color-status-bad)' }}>
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={checkout}
          disabled={cart.length === 0 || submitting}
          className="rounded-md px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
          style={{ backgroundColor: 'var(--color-accent)' }}
        >
          {submitting ? 'Completing sale…' : `Complete sale · ${money(Math.max(0, estimatedTotal))}`}
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-[calc(100vh-56px)]">
      {/* Quick-access category rail */}
      <div className="hidden w-40 shrink-0 flex-col gap-0.5 overflow-y-auto border-r p-2 xl:flex" style={{ borderColor: 'var(--color-border)' }}>
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
            className="rounded-md px-2.5 py-2 text-left text-sm font-medium"
            style={{ backgroundColor: activeCategory === c.id ? 'var(--color-accent-soft)' : 'transparent', color: activeCategory === c.id ? 'var(--color-accent)' : 'var(--color-ink-600)' }}
          >
            {c.name}
          </button>
        ))}
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="border-b p-4" style={{ borderColor: 'var(--color-border)' }}>
          <div className="relative">
            <Search size={16} strokeWidth={2} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-ink-600)' }} />
            <input
              ref={searchRef}
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder='Search products — try "1.5 inch square pipe" or a SKU. ↑↓ to pick, Enter to add.'
              className="w-full rounded-md border py-3 pl-10 pr-3 text-base outline-none focus:border-[var(--color-accent)]"
              style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-ink-900)' }}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {visibleProducts.map((p, i) => {
              const gauge = thicknessLabel(p.shape, p.thicknessMm);
              const isHighlighted = query.trim().length > 0 && i === highlighted;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => addToCart(p)}
                  onMouseEnter={() => query.trim().length > 0 && setHighlighted(i)}
                  className="flex flex-col items-start gap-2 rounded-lg border p-3 text-left transition-colors"
                  style={{
                    borderColor: isHighlighted ? 'var(--color-accent)' : 'var(--color-border)',
                    backgroundColor: isHighlighted ? 'var(--color-accent-soft)' : 'var(--color-surface)',
                  }}
                >
                  <ProductThumb product={p} size={64} />
                  <div className="w-full">
                    <p className="text-sm font-medium" style={{ color: 'var(--color-ink-900)' }}>
                      {p.displayName ?? p.name}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--color-ink-600)' }}>
                      {[p.nominalSize, gauge].filter(Boolean).join(' · ') || p.name}
                    </p>
                    <div className="mt-1 flex w-full items-center justify-between">
                      <span className="text-sm font-semibold data-num" style={{ color: 'var(--color-ink-900)' }}>
                        {money(p.basePrice)}
                      </span>
                      <span className="text-xs data-num" style={{ color: p.stockQuantity > 0 ? 'var(--color-status-ok)' : 'var(--color-status-bad)' }}>
                        {p.stockQuantity} {p.unit.symbol}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          {query && visibleProducts.length === 0 && (
            <p className="mt-10 text-center text-sm" style={{ color: 'var(--color-ink-600)' }}>
              No products match "{query}".
            </p>
          )}
        </div>
      </div>

      {/* Desktop cart — larger, since it's the working surface at a real till */}
      <div className="hidden w-[28rem] shrink-0 border-l lg:block" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
        {cartContent}
      </div>

      {/* Mobile: sticky summary bar -> full-screen cart */}
      {cart.length > 0 && !mobileCartOpen && (
        <button
          type="button"
          onClick={() => setMobileCartOpen(true)}
          className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-between px-4 py-3 text-sm font-medium text-white lg:hidden"
          style={{ backgroundColor: 'var(--color-accent)' }}
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

      {receipt && <ReceiptDialog sale={receipt} onClose={() => setReceipt(null)} />}
    </div>
  );
}