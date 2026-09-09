'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Drawer } from '../ui/Drawer';
import { customersApi, type Customer } from '../../lib/customers-api';
import { ApiError } from '../../lib/api';

const inputStyle = { borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-ink-900)' };
const labelClass = 'mb-1.5 block text-[11px] font-semibold uppercase';
const labelStyle = { color: 'var(--color-ink-600)', letterSpacing: '0.06em' };

export function CustomerFormDrawer({
  open,
  onClose,
  onSaved,
  customer,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  customer: Customer | null;
}) {
  const isEdit = !!customer;
  const [name, setName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [phone, setPhone] = useState('');
  const [altPhone, setAltPhone] = useState('');
  const [location, setLocation] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [isCredit, setIsCredit] = useState(false);
  const [creditLimit, setCreditLimit] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(customer?.name ?? '');
    setBusinessName(customer?.businessName ?? '');
    setPhone(customer?.phone ?? '');
    setAltPhone(customer?.altPhone ?? '');
    setLocation(customer?.location ?? '');
    setAddress(customer?.address ?? '');
    setNotes(customer?.notes ?? '');
    setIsCredit(customer?.isCredit ?? false);
    setCreditLimit(customer?.creditLimit != null ? String(customer.creditLimit) : '');
    setError(null);
  }, [open, customer]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name,
        businessName: businessName || undefined,
        phone: phone || undefined,
        altPhone: altPhone || undefined,
        location: location || undefined,
        address: address || undefined,
        notes: notes || undefined,
        isCredit,
        creditLimit: creditLimit ? Number(creditLimit) : undefined,
      };
      if (isEdit && customer) await customersApi.update(customer.id, payload);
      else await customersApi.create(payload);
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save customer.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit customer' : 'Add customer'}
      footer={
        <div className="flex items-center gap-3">
          <button type="submit" form="customer-form" disabled={saving} className="rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-60" style={{ backgroundColor: 'var(--color-accent)' }}>
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add customer'}
          </button>
          {error && (
            <span className="text-sm" style={{ color: 'var(--color-status-bad)' }}>
              {error}
            </span>
          )}
        </div>
      }
    >
      <form id="customer-form" onSubmit={handleSubmit} className="flex flex-col gap-3.5">
        <div>
          <label className={labelClass} style={labelStyle}>
            Name
          </label>
          <input required value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]" style={inputStyle} />
        </div>
        <div>
          <label className={labelClass} style={labelStyle}>
            Business name
          </label>
          <input value={businessName} onChange={(e) => setBusinessName(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]" style={inputStyle} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass} style={labelStyle}>
              Phone
            </label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]" style={inputStyle} />
          </div>
          <div>
            <label className={labelClass} style={labelStyle}>
              Alternate phone
            </label>
            <input value={altPhone} onChange={(e) => setAltPhone(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]" style={inputStyle} />
          </div>
        </div>
        <div>
          <label className={labelClass} style={labelStyle}>
            Location
          </label>
          <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Ruiru" className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]" style={inputStyle} />
        </div>
        <div>
          <label className={labelClass} style={labelStyle}>
            Address
          </label>
          <input value={address} onChange={(e) => setAddress(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]" style={inputStyle} />
        </div>
        <div>
          <label className={labelClass} style={labelStyle}>
            Notes
          </label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]" style={inputStyle} />
        </div>

        <div className="mt-1 rounded-md border p-3" style={{ borderColor: 'var(--color-border)' }}>
          <label className="flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--color-ink-900)' }}>
            <input type="checkbox" checked={isCredit} onChange={(e) => setIsCredit(e.target.checked)} />
            Credit account
          </label>
          {isCredit && (
            <div className="mt-3">
              <label className={labelClass} style={labelStyle}>
                Credit limit (KSh)
              </label>
              <input type="number" min="0" value={creditLimit} onChange={(e) => setCreditLimit(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)] data-num" style={inputStyle} />
            </div>
          )}
        </div>
      </form>
    </Drawer>
  );
}