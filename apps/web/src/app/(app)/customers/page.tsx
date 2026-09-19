'use client';

import { useEffect, useState } from 'react';
import { Archive, Eye, Pencil, Plus, RotateCcw, Search, Users } from 'lucide-react';
import { customersApi, type Customer, type CustomerStatus } from '../../../lib/customers-api';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { ApiError } from '../../../lib/api';
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
  const [status, setStatus] = useState<CustomerStatus>('active');
  const [error, setError] = useState<string | null>(null);
  const [confirmArchive, setConfirmArchive] = useState<Customer | null>(null);
  const [archiveBusy, setArchiveBusy] = useState(false);

  async function load() {
    setCustomers(await customersApi.list(search || undefined, status));
  }

  useEffect(() => {
    const t = setTimeout(load, search ? 250 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status]);

  async function archiveCustomer(c: Customer) {
    setArchiveBusy(true);
    try {
      await customersApi.archive(c.id);
      setConfirmArchive(null);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not archive this customer.');
      setConfirmArchive(null);
    } finally {
      setArchiveBusy(false);
    }
  }

  async function restoreCustomer(c: Customer) {
    setError(null);
    try {
      await customersApi.restore(c.id);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not restore this customer.');
    }
  }

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

      <div className="mt-4 flex gap-1.5">
        {(['active', 'archived'] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus(s)}
            className="min-h-9 rounded-md border px-3 text-sm font-medium"
            style={{
              borderColor: status === s ? 'var(--color-accent)' : 'var(--color-border)',
              backgroundColor: status === s ? 'var(--color-accent-soft)' : 'transparent',
              color: status === s ? 'var(--color-accent)' : 'var(--color-ink-600)',
            }}
          >
            {s === 'active' ? 'Active' : 'Archived'}
          </button>
        ))}
      </div>

      {error && (
        <button type="button" onClick={() => setError(null)} className="mt-3 w-full rounded-md px-3 py-2 text-left text-sm" style={{ backgroundColor: 'var(--color-status-badSoft)', color: 'var(--color-status-bad)' }}>
          {error}
        </button>
      )}

      <div className="relative mt-3 max-w-sm">
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
              <th className="px-4 py-2.5 text-right font-medium" style={{ color: 'var(--color-ink-600)' }}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {customers === null &&
              [...Array(5)].map((_, i) => (
                <tr key={i} className="border-b" style={{ borderColor: 'var(--color-border)' }}>
                  <td className="px-4 py-3" colSpan={5}>
                    <div className="h-4 w-2/3 animate-pulse rounded" style={{ backgroundColor: 'var(--color-border)' }} />
                  </td>
                </tr>
              ))}

            {customers?.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center">
                  <Users size={28} strokeWidth={1.5} className="mx-auto mb-2" style={{ color: 'var(--color-ink-600)' }} />
                  <p className="text-sm font-medium" style={{ color: 'var(--color-ink-900)' }}>
                    {status === 'archived' ? 'No archived customers' : 'No customers yet'}
                  </p>
                  <p className="mt-1 text-sm" style={{ color: 'var(--color-ink-600)' }}>
                    {status === 'archived' ? 'Customers you archive will show up here.' : 'Add your first customer to start tracking purchases and credit.'}
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
                <td className="px-2 py-2">
                  <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                    <button type="button" title="View" aria-label="View" onClick={() => setDetailId(c.id)} className="flex h-9 w-9 items-center justify-center rounded-md border" style={{ borderColor: 'var(--color-border)', color: 'var(--color-ink-600)' }}>
                      <Eye size={15} strokeWidth={2} />
                    </button>
                    <button
                      type="button"
                      title="Edit customer"
                      aria-label="Edit customer"
                      onClick={() => {
                        setEditing(c);
                        setFormOpen(true);
                      }}
                      className="flex h-9 w-9 items-center justify-center rounded-md border"
                      style={{ borderColor: 'var(--color-border)', color: 'var(--color-ink-600)' }}
                    >
                      <Pencil size={15} strokeWidth={2} />
                    </button>
                    {c.active ? (
                      <button type="button" title="Archive customer" aria-label="Archive customer" onClick={() => setConfirmArchive(c)} className="flex h-9 w-9 items-center justify-center rounded-md border" style={{ borderColor: 'var(--color-border)', color: 'var(--color-status-bad)' }}>
                        <Archive size={15} strokeWidth={2} />
                      </button>
                    ) : (
                      <button type="button" title="Restore customer" aria-label="Restore customer" onClick={() => restoreCustomer(c)} className="flex h-9 w-9 items-center justify-center rounded-md border" style={{ borderColor: 'var(--color-border)', color: 'var(--color-accent)' }}>
                        <RotateCcw size={15} strokeWidth={2} />
                      </button>
                    )}
                  </div>
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
                {status === 'archived' ? 'No archived customers' : 'No customers yet'}
              </p>
              <p className="mt-1 text-sm" style={{ color: 'var(--color-ink-600)' }}>
                {status === 'archived' ? 'Customers you archive will show up here.' : 'Add your first customer to start tracking purchases and credit.'}
              </p>
            </div>
          )}

          {customers?.map((c) => (
            <div key={c.id} onClick={() => setDetailId(c.id)} className="flex w-full flex-col gap-1.5 p-4 text-left transition-colors active:bg-[var(--color-bg)]">
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
              <div className="mt-1.5 flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(c);
                    setFormOpen(true);
                  }}
                  className="flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-md border text-xs font-medium"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-ink-900)' }}
                >
                  <Pencil size={13} strokeWidth={2} />
                  Edit
                </button>
                {c.active ? (
                  <button type="button" onClick={() => setConfirmArchive(c)} aria-label="Archive customer" title="Archive customer" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border" style={{ borderColor: 'var(--color-border)', color: 'var(--color-status-bad)' }}>
                    <Archive size={14} strokeWidth={2} />
                  </button>
                ) : (
                  <button type="button" onClick={() => restoreCustomer(c)} aria-label="Restore customer" title="Restore customer" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border" style={{ borderColor: 'var(--color-border)', color: 'var(--color-accent)' }}>
                    <RotateCcw size={14} strokeWidth={2} />
                  </button>
                )}
              </div>
            </div>
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

      {confirmArchive && (
        <ConfirmDialog
          title="Archive this customer?"
          description={`${confirmArchive.businessName || confirmArchive.name} will drop off the customer list and the POS. Their documents and ledger history are unaffected, and they can be restored any time.${
            confirmArchive.isCredit && confirmArchive.creditBalance > 0 ? ` They currently owe KSh ${confirmArchive.creditBalance.toLocaleString()}.` : ''
          }`}
          confirmLabel="Archive"
          busy={archiveBusy}
          onCancel={() => setConfirmArchive(null)}
          onConfirm={() => archiveCustomer(confirmArchive)}
        />
      )}
    </div>
  );
}