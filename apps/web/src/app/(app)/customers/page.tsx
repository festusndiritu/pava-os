'use client';

import { useEffect, useState } from 'react';
import { Plus, Search, Users } from 'lucide-react';
import { customersApi, type Customer } from '../../../lib/customers-api';
import { CustomerFormDrawer } from '../../../components/customers/CustomerFormDrawer';
import { CustomerDetailDrawer } from '../../../components/customers/CustomerDetailDrawer';

const inputStyle = { borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-ink-900)' };

function CreditBadge({ customer }: { customer: Customer }) {
  if (!customer.isCredit) {
    return (
      <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-ink-600)' }}>
        Cash
      </span>
    );
  }
  const overLimit = customer.creditLimit != null && customer.creditBalance > customer.creditLimit;
  return (
    <span
      className="rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ backgroundColor: overLimit ? 'var(--color-status-badSoft)' : 'var(--color-status-okSoft)', color: overLimit ? 'var(--color-status-bad)' : 'var(--color-status-ok)' }}
    >
      Credit
    </span>
  );
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  async function load() {
    setCustomers(await customersApi.list(search || undefined));
  }

  useEffect(() => {
    const t = setTimeout(load, search ? 250 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight" style={{ color: 'var(--color-ink-900)' }}>
            Customers
          </h1>
          <p className="mt-0.5 text-sm" style={{ color: 'var(--color-ink-600)' }}>
            Profiles, credit accounts, and outstanding balances.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
          className="flex items-center gap-1.5 rounded-md px-3.5 py-2 text-sm font-medium text-white"
          style={{ backgroundColor: 'var(--color-accent)' }}
        >
          <Plus size={15} strokeWidth={2} />
          Add customer
        </button>
      </div>

      <div className="relative mt-5 max-w-sm">
        <Search size={15} strokeWidth={2} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-ink-600)' }} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, business, or phone"
          className="w-full rounded-md border py-2 pl-8 pr-3 text-sm outline-none focus:border-[var(--color-accent)]"
          style={inputStyle}
        />
      </div>

      <div className="mt-5 overflow-hidden rounded-lg border" style={{ borderColor: 'var(--color-border)' }}>
        {/* Desktop/tablet table */}
        <table className="hidden w-full text-sm md:table">
          <thead>
            <tr className="border-b text-left" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)' }}>
              <th className="px-4 py-2.5 font-medium" style={{ color: 'var(--color-ink-600)' }}>
                Customer
              </th>
              <th className="px-4 py-2.5 font-medium" style={{ color: 'var(--color-ink-600)' }}>
                Phone
              </th>
              <th className="px-4 py-2.5 font-medium" style={{ color: 'var(--color-ink-600)' }}>
                Type
              </th>
              <th className="px-4 py-2.5 text-right font-medium" style={{ color: 'var(--color-ink-600)' }}>
                Balance
              </th>
            </tr>
          </thead>
          <tbody>
            {customers === null &&
              [...Array(5)].map((_, i) => (
                <tr key={i} className="border-b" style={{ borderColor: 'var(--color-border)' }}>
                  <td className="px-4 py-3" colSpan={4}>
                    <div className="h-4 w-2/3 animate-pulse rounded" style={{ backgroundColor: 'var(--color-border)' }} />
                  </td>
                </tr>
              ))}

            {customers?.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-12 text-center">
                  <Users size={28} strokeWidth={1.5} className="mx-auto mb-2" style={{ color: 'var(--color-ink-600)' }} />
                  <p className="text-sm font-medium" style={{ color: 'var(--color-ink-900)' }}>
                    No customers yet
                  </p>
                  <p className="mt-1 text-sm" style={{ color: 'var(--color-ink-600)' }}>
                    Add your first customer to start tracking purchases and credit.
                  </p>
                </td>
              </tr>
            )}

            {customers?.map((c) => (
              <tr key={c.id} onClick={() => setDetailId(c.id)} className="cursor-pointer border-b transition-colors last:border-0 hover:bg-[var(--color-bg)]" style={{ borderColor: 'var(--color-border)' }}>
                <td className="px-4 py-3">
                  <p className="font-medium" style={{ color: 'var(--color-ink-900)' }}>
                    {c.name}
                  </p>
                  {c.businessName && (
                    <p className="text-xs" style={{ color: 'var(--color-ink-600)' }}>
                      {c.businessName}
                    </p>
                  )}
                </td>
                <td className="px-4 py-3" style={{ color: 'var(--color-ink-600)' }}>
                  {c.phone ?? '—'}
                </td>
                <td className="px-4 py-3">
                  <CreditBadge customer={c} />
                </td>
                <td className="px-4 py-3 text-right font-medium data-num" style={{ color: 'var(--color-ink-900)' }}>
                  {c.isCredit ? `KSh ${c.creditBalance.toLocaleString()}` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Mobile cards */}
        <div className="divide-y divide-[var(--color-border)] md:hidden">
          {customers === null &&
            [...Array(3)].map((_, i) => (
              <div key={i} className="p-4">
                <div className="h-4 w-2/3 animate-pulse rounded" style={{ backgroundColor: 'var(--color-border)' }} />
              </div>
            ))}

          {customers?.length === 0 && (
            <div className="px-4 py-12 text-center">
              <Users size={28} strokeWidth={1.5} className="mx-auto mb-2" style={{ color: 'var(--color-ink-600)' }} />
              <p className="text-sm font-medium" style={{ color: 'var(--color-ink-900)' }}>
                No customers yet
              </p>
              <p className="mt-1 text-sm" style={{ color: 'var(--color-ink-600)' }}>
                Add your first customer to start tracking purchases and credit.
              </p>
            </div>
          )}

          {customers?.map((c) => (
            <button key={c.id} type="button" onClick={() => setDetailId(c.id)} className="flex w-full flex-col gap-1.5 p-4 text-left transition-colors active:bg-[var(--color-bg)]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium" style={{ color: 'var(--color-ink-900)' }}>
                    {c.name}
                  </p>
                  {c.businessName && (
                    <p className="truncate text-xs" style={{ color: 'var(--color-ink-600)' }}>
                      {c.businessName}
                    </p>
                  )}
                </div>
                {c.isCredit && (
                  <p className="shrink-0 font-medium data-num" style={{ color: 'var(--color-ink-900)' }}>
                    KSh {c.creditBalance.toLocaleString()}
                  </p>
                )}
              </div>
              <div className="flex items-center justify-between text-sm">
                <span style={{ color: 'var(--color-ink-600)' }}>{c.phone ?? '—'}</span>
                <CreditBadge customer={c} />
              </div>
            </button>
          ))}
        </div>
      </div>

      <CustomerFormDrawer open={formOpen} onClose={() => setFormOpen(false)} onSaved={load} customer={editing} />
      <CustomerDetailDrawer
        customerId={detailId}
        onClose={() => setDetailId(null)}
        onEdit={(c) => {
          setDetailId(null);
          setEditing(c);
          setFormOpen(true);
        }}
        onChanged={load}
      />
    </div>
  );
}