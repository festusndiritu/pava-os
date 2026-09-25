'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Package, Users, FileText, Receipt, Target } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { useAuth } from '../../lib/auth-context';
import { useDebounced } from '../../lib/use-paged-list';
import { productsApi, type Product } from '../../lib/products-api';
import { customersApi, type Customer } from '../../lib/customers-api';
import { documentsApi, type SaleDocument } from '../../lib/documents-api';
import { leadsApi, type Lead } from '../../lib/leads-api';
import { money } from '../../lib/format';

/**
 * The one place to jump straight to a record instead of drilling into its
 * module first — Products, Customers, Invoices/Quotes and Leads all support
 * a `search` param already, so this just fans the same query out to each of
 * them in parallel rather than adding a new backend endpoint. Every result
 * routes to its module's existing page with `?open=<id>`, which those pages
 * already know how to turn into the same detail drawer/edit form a normal
 * click would open.
 */

interface Row {
  id: string;
  icon: typeof Package;
  title: string;
  subtitle: string;
  meta?: string;
  href: string;
}

function docHref(doc: SaleDocument) {
  return doc.type === 'QUOTE' ? `/quotes?open=${doc.id}` : `/invoices?open=${doc.id}`;
}

function docNumber(doc: SaleDocument) {
  return doc.receiptNumber ?? doc.invoiceNumber ?? doc.quoteNumber ?? doc.deliveryNoteNumber ?? doc.id.slice(0, 8);
}

export function GlobalSearch({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { hasPermission } = useAuth();
  const [query, setQuery] = useState('');
  const [highlighted, setHighlighted] = useState(0);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [docs, setDocs] = useState<SaleDocument[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const debounced = useDebounced(query);

  const canProducts = hasPermission('PRODUCTS');
  const canCustomers = hasPermission('CUSTOMERS');
  const canInvoices = hasPermission('INVOICES');
  const canQuotes = hasPermission('QUOTES');
  const canLeads = hasPermission('LEADS');

  // The leads list has no `search` param of its own — leads are few enough
  // per business that fetching once per open and filtering client-side as
  // the person types is simpler than adding one just for this.
  useEffect(() => {
    if (canLeads) leadsApi.list().then(setLeads).catch(() => setLeads([]));
  }, [canLeads]);

  useEffect(() => {
    setHighlighted(0);
    const q = debounced.trim();
    if (q.length < 1) {
      setProducts([]);
      setCustomers([]);
      setDocs([]);
      return;
    }
    let stale = false;
    if (canProducts) productsApi.list({ search: q }).then((r) => !stale && setProducts(r.slice(0, 5)));
    if (canCustomers) customersApi.list(q).then((r) => !stale && setCustomers(r.slice(0, 5)));
    if (canInvoices || canQuotes) documentsApi.list({ search: q, limit: 6 }).then((r) => !stale && setDocs(r));
    return () => {
      stale = true;
    };
  }, [debounced, canProducts, canCustomers, canInvoices, canQuotes]);

  const q = debounced.trim().toLowerCase();
  const leadMatches = useMemo(() => {
    if (!canLeads || q.length < 1) return [];
    return leads
      .filter((l) => [l.name, l.company, l.phone, l.location].some((v) => v?.toLowerCase().includes(q)))
      .slice(0, 5);
  }, [leads, q, canLeads]);

  const docMatches = docs.filter((d) => (d.type === 'QUOTE' ? canQuotes : canInvoices));

  const groups: { label: string; rows: Row[] }[] = [
    {
      label: 'Products',
      rows: products.map((p) => ({
        id: p.id,
        icon: Package,
        title: p.displayName ?? p.name,
        subtitle: [p.nominalSize, p.unit.symbol].filter(Boolean).join(' · '),
        meta: money(p.basePrice),
        href: `/products?open=${p.id}`,
      })),
    },
    {
      label: 'Customers',
      rows: customers.map((c) => ({
        id: c.id,
        icon: Users,
        title: c.businessName || c.name,
        subtitle: [c.phone, c.location].filter(Boolean).join(' · ') || 'No phone on file',
        href: `/customers?open=${c.id}`,
      })),
    },
    {
      label: 'Invoices & quotes',
      rows: docMatches.map((d) => ({
        id: d.id,
        icon: d.type === 'QUOTE' ? FileText : Receipt,
        title: docNumber(d),
        subtitle: d.customer?.businessName || d.customer?.name || d.customerName || 'Walk-in',
        meta: money(d.total),
        href: docHref(d),
      })),
    },
    {
      label: 'Leads',
      rows: leadMatches.map((l) => ({
        id: l.id,
        icon: Target,
        title: l.name,
        subtitle: [l.company, l.phone].filter(Boolean).join(' · ') || 'No phone on file',
        href: `/leads?open=${l.id}`,
      })),
    },
  ].filter((g) => g.rows.length > 0);

  const flatRows = groups.flatMap((g) => g.rows);
  const hasQuery = debounced.trim().length > 0;

  function go(row: Row) {
    router.push(row.href);
    onClose();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (flatRows.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, flatRows.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const chosen = flatRows[highlighted];
      if (chosen) go(chosen);
    }
  }

  let rowIndex = -1;

  return (
    <Modal onClose={onClose} placement="center" label="Search" className="flex max-h-[28rem] w-full max-w-lg flex-col overflow-hidden sm:max-h-[32rem]">
      <div className="shrink-0 border-b p-3" style={{ borderColor: 'var(--color-border)' }}>
        <div className="relative">
          <Search size={15} strokeWidth={2} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-ink-600)' }} />
          <input
            data-autofocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search products, customers, invoices, quotes, leads…"
            className="min-h-11 w-full rounded-md border py-2 pl-8 pr-3 text-sm outline-none focus:border-[var(--color-accent)]"
            style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-ink-900)' }}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {!hasQuery && (
          <p className="px-2 py-6 text-center text-sm" style={{ color: 'var(--color-ink-600)' }}>
            Start typing to jump straight to a record.
          </p>
        )}

        {hasQuery && flatRows.length === 0 && (
          <p className="px-2 py-6 text-center text-sm" style={{ color: 'var(--color-ink-600)' }}>
            No matches for &ldquo;{debounced}&rdquo;.
          </p>
        )}

        {groups.map((group) => (
          <div key={group.label} className="mb-1">
            <p className="px-2.5 py-1 text-[11px] font-semibold uppercase" style={{ color: 'var(--color-ink-600)', letterSpacing: '0.06em' }}>
              {group.label}
            </p>
            {group.rows.map((row) => {
              rowIndex += 1;
              const Icon = row.icon;
              const active = rowIndex === highlighted;
              return (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => go(row)}
                  onMouseEnter={() => setHighlighted(rowIndex)}
                  className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors"
                  style={{ backgroundColor: active ? 'var(--color-accent-soft)' : 'transparent' }}
                >
                  <Icon size={16} strokeWidth={2} style={{ color: active ? 'var(--color-accent)' : 'var(--color-ink-600)' }} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium" style={{ color: 'var(--color-ink-900)' }}>
                      {row.title}
                    </span>
                    <span className="block truncate text-xs" style={{ color: 'var(--color-ink-600)' }}>
                      {row.subtitle}
                    </span>
                  </span>
                  {row.meta && (
                    <span className="data-num shrink-0 text-xs font-medium" style={{ color: 'var(--color-ink-900)' }}>
                      {row.meta}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </Modal>
  );
}
