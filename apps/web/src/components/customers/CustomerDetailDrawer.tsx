'use client';

import { useEffect, useState } from 'react';
import { Drawer } from '../ui/Drawer';
import { customersApi, type Customer, type CustomerLedgerEntry } from '../../lib/customers-api';
import { ApiError } from '../../lib/api';

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));
}
function money(n: number) {
  return `KSh ${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

const ENTRY_LABEL: Record<CustomerLedgerEntry['type'], string> = {
  INVOICE: 'Invoice',
  PAYMENT: 'Payment',
  ADJUSTMENT: 'Adjustment',
  OPENING: 'Opening balance',
  REFUND: 'Refund',
  WRITE_OFF: 'Write-off',
};

export function CustomerDetailDrawer({
  customerId,
  onClose,
  onEdit,
  onChanged,
}: {
  customerId: string | null;
  onClose: () => void;
  onEdit: (c: Customer) => void;
  onChanged: () => void;
}) {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [ledger, setLedger] = useState<CustomerLedgerEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState<'payment' | 'adjustment' | null>(null);

  async function load() {
    if (!customerId) return;
    setLoading(true);
    const [c, l] = await Promise.all([customersApi.get(customerId), customersApi.ledger(customerId)]);
    setCustomer(c);
    setLedger(l);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  if (!customerId) return null;

  const overLimit = customer?.isCredit && customer.creditLimit != null && customer.creditBalance > customer.creditLimit;

  return (
    <>
      <Drawer
        open
        onClose={onClose}
        title={customer?.businessName || customer?.name || 'Customer'}
        subtitle={customer?.businessName ? customer.name : customer?.phone ?? undefined}
        footer={
          customer && (
            <div className="flex gap-2">
              <button type="button" onClick={() => onEdit(customer)} className="flex-1 rounded-md border px-4 py-2 text-sm font-medium" style={{ borderColor: 'var(--color-border)', color: 'var(--color-ink-900)' }}>
                Edit
              </button>
              {customer.isCredit && (
                <>
                  <button type="button" onClick={() => setAction('payment')} className="flex-1 rounded-md px-4 py-2 text-sm font-medium text-white" style={{ backgroundColor: 'var(--color-accent)' }}>
                    Record payment
                  </button>
                  <button type="button" onClick={() => setAction('adjustment')} className="flex-1 rounded-md border px-4 py-2 text-sm font-medium" style={{ borderColor: 'var(--color-border)', color: 'var(--color-ink-900)' }}>
                    Adjust
                  </button>
                </>
              )}
            </div>
          )
        }
      >
        {loading && (
          <p className="text-sm" style={{ color: 'var(--color-ink-600)' }}>
            Loading…
          </p>
        )}

        {customer && !loading && (
          <div className="flex flex-col gap-5">
            {customer.isCredit && (
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-md border p-3" style={{ borderColor: overLimit ? 'var(--color-status-bad)' : 'var(--color-border)' }}>
                  <p className="text-[11px] uppercase" style={{ color: 'var(--color-ink-600)' }}>
                    Outstanding balance
                  </p>
                  <p className="mt-0.5 text-lg font-semibold data-num" style={{ color: overLimit ? 'var(--color-status-bad)' : 'var(--color-ink-900)' }}>
                    {money(customer.creditBalance)}
                  </p>
                </div>
                <div className="rounded-md border p-3" style={{ borderColor: 'var(--color-border)' }}>
                  <p className="text-[11px] uppercase" style={{ color: 'var(--color-ink-600)' }}>
                    Credit limit
                  </p>
                  <p className="mt-0.5 text-lg font-semibold data-num" style={{ color: 'var(--color-ink-900)' }}>
                    {customer.creditLimit != null ? money(customer.creditLimit) : '—'}
                  </p>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-1 text-sm" style={{ color: 'var(--color-ink-600)' }}>
              {customer.phone && <p>Phone: {customer.phone}</p>}
              {customer.altPhone && <p>Alternate: {customer.altPhone}</p>}
              {customer.location && <p>Location: {customer.location}</p>}
              {customer.address && <p>Address: {customer.address}</p>}
              {customer.notes && <p>Notes: {customer.notes}</p>}
            </div>

            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase" style={{ color: 'var(--color-ink-900)', letterSpacing: '0.04em' }}>
                Credit ledger
              </h3>
              {ledger.length === 0 && (
                <p className="text-sm" style={{ color: 'var(--color-ink-600)' }}>
                  No ledger entries yet.
                </p>
              )}
              <div className="flex flex-col gap-2">
                {ledger.map((e) => (
                  <div key={e.id} className="flex items-center justify-between rounded-md border px-3 py-2.5" style={{ borderColor: 'var(--color-border)' }}>
                    <div>
                      <p className="text-sm font-medium" style={{ color: 'var(--color-ink-900)' }}>
                        {ENTRY_LABEL[e.type]}
                        {e.note ? ` · ${e.note}` : ''}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--color-ink-600)' }}>
                        {fmtDate(e.createdAt)} · {e.createdBy.name}
                      </p>
                    </div>
                    <p className="text-sm font-medium data-num" style={{ color: e.amount >= 0 ? 'var(--color-status-bad)' : 'var(--color-status-ok)' }}>
                      {e.amount >= 0 ? '+' : ''}
                      {money(e.amount)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Drawer>

      {action && customer && (
        <LedgerActionDialog
          customer={customer}
          mode={action}
          onClose={() => setAction(null)}
          onDone={() => {
            setAction(null);
            load();
            onChanged();
          }}
        />
      )}
    </>
  );
}

function LedgerActionDialog({
  customer,
  mode,
  onClose,
  onDone,
}: {
  customer: Customer;
  mode: 'payment' | 'adjustment';
  onClose: () => void;
  onDone: () => void;
}) {
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'ADJUSTMENT' | 'OPENING' | 'REFUND' | 'WRITE_OFF'>('ADJUSTMENT');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    const value = Number(amount);
    if (!value) return;
    setSaving(true);
    setError(null);
    try {
      if (mode === 'payment') {
        await customersApi.recordPayment(customer.id, value, note || undefined);
      } else {
        await customersApi.adjustBalance(customer.id, value, type, note || undefined);
      }
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0" style={{ backgroundColor: 'rgba(16, 24, 40, 0.5)' }} onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-lg border p-5" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-card)' }}>
        <h3 className="text-sm font-semibold" style={{ color: 'var(--color-ink-900)' }}>
          {mode === 'payment' ? `Record payment — ${customer.name}` : `Adjust balance — ${customer.name}`}
        </h3>
        <p className="mt-1 text-xs" style={{ color: 'var(--color-ink-600)' }}>
          Current balance: {money(customer.creditBalance)}
        </p>

        <div className="mt-4 flex flex-col gap-3">
          {mode === 'adjustment' && (
            <select value={type} onChange={(e) => setType(e.target.value as typeof type)} className="w-full rounded-md border px-3 py-2 text-sm" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-ink-900)' }}>
              <option value="ADJUSTMENT">Adjustment</option>
              <option value="OPENING">Opening balance</option>
              <option value="REFUND">Refund</option>
              <option value="WRITE_OFF">Write-off</option>
            </select>
          )}
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={mode === 'adjustment' ? 'Amount (negative reduces balance)' : 'Amount received'}
            className="w-full rounded-md border px-3 py-2 text-sm data-num"
            style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-ink-900)' }}
          />
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note"
            className="w-full rounded-md border px-3 py-2 text-sm"
            style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-ink-900)' }}
          />

          {error && (
            <p className="rounded-md px-3 py-2 text-sm" style={{ backgroundColor: 'var(--color-status-badSoft)', color: 'var(--color-status-bad)' }}>
              {error}
            </p>
          )}

          <div className="mt-1 flex gap-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-md border px-4 py-2 text-sm font-medium" style={{ borderColor: 'var(--color-border)', color: 'var(--color-ink-900)' }}>
              Cancel
            </button>
            <button type="button" onClick={submit} disabled={saving || !amount} className="flex-1 rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-60" style={{ backgroundColor: 'var(--color-accent)' }}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}