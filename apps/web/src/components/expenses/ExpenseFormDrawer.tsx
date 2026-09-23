'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Drawer } from '../ui/Drawer';
import { expensesApi, type Expense, type ExpenseCategory, type ExpenseStatus, type PaymentMethod } from '../../lib/expenses-api';
import { ApiError } from '../../lib/api';

const inputStyle = { borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-ink-900)' };
const labelClass = 'mb-1.5 block text-[11px] font-semibold uppercase';
const labelStyle = { color: 'var(--color-ink-600)', letterSpacing: '0.06em' };

export function ExpenseFormDrawer({
  open,
  onClose,
  onSaved,
  expense,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  expense: Expense | null;
}) {
  const isEdit = !!expense;
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [categoryId, setCategoryId] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [description, setDescription] = useState('');
  const [vendor, setVendor] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | ''>('');
  const [reference, setReference] = useState('');
  const [status, setStatus] = useState<ExpenseStatus>('APPROVED');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    expensesApi.categories().then(setCategories);
    setCategoryId(expense?.categoryId ?? '');
    setNewCategory('');
    setAmount(expense?.amount != null ? String(expense.amount) : '');
    setDate(expense?.date ? expense.date.slice(0, 10) : new Date().toISOString().slice(0, 10));
    setDescription(expense?.description ?? '');
    setVendor(expense?.vendor ?? '');
    setPaymentMethod(expense?.paymentMethod ?? '');
    setReference(expense?.reference ?? '');
    setStatus(expense?.status ?? 'APPROVED');
    setNotes(expense?.notes ?? '');
    setError(null);
  }, [open, expense]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        categoryId: categoryId || undefined,
        categoryName: !categoryId && newCategory ? newCategory : undefined,
        amount: Math.round(Number(amount)),
        date: date || undefined,
        description: description || undefined,
        vendor: vendor || undefined,
        paymentMethod: paymentMethod || undefined,
        reference: reference || undefined,
        status,
        notes: notes || undefined,
      };
      if (isEdit && expense) await expensesApi.update(expense.id, payload);
      else await expensesApi.create(payload);
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save expense.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit expense' : 'Add expense'}
      footer={
        <div className="flex items-center gap-3">
          <button type="submit" form="expense-form" disabled={saving || !amount} className="rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-60" style={{ backgroundColor: 'var(--color-accent)' }}>
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add expense'}
          </button>
          {error && (
            <span className="text-sm" style={{ color: 'var(--color-status-bad)' }}>
              {error}
            </span>
          )}
        </div>
      }
    >
      <form id="expense-form" onSubmit={handleSubmit} className="flex flex-col gap-3.5">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass} style={labelStyle}>
              Amount (KSh)
            </label>
            <input required type="number" min="1" step="1" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)] data-num" style={inputStyle} />
          </div>
          <div>
            <label className={labelClass} style={labelStyle}>
              Date
            </label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]" style={inputStyle} />
          </div>
        </div>

        <div>
          <label className={labelClass} style={labelStyle}>
            Category
          </label>
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]" style={inputStyle}>
            <option value="">
              {newCategory ? `New: ${newCategory}` : 'Select or type new below'}
            </option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {!categoryId && (
            <input
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              placeholder="Or create a new category"
              className="mt-2 w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
              style={inputStyle}
            />
          )}
        </div>

        <div>
          <label className={labelClass} style={labelStyle}>
            Description
          </label>
          <input value={description} onChange={(e) => setDescription(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]" style={inputStyle} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass} style={labelStyle}>
              Vendor / payee
            </label>
            <input value={vendor} onChange={(e) => setVendor(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]" style={inputStyle} />
          </div>
          <div>
            <label className={labelClass} style={labelStyle}>
              Payment method
            </label>
            <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod | '')} className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]" style={inputStyle}>
              <option value="">—</option>
              <option value="CASH">Cash</option>
              <option value="MPESA">M-Pesa</option>
              <option value="CARD">Card</option>
              <option value="CREDIT">Credit</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass} style={labelStyle}>
              Reference
            </label>
            <input value={reference} onChange={(e) => setReference(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]" style={inputStyle} />
          </div>
          <div>
            <label className={labelClass} style={labelStyle}>
              Status
            </label>
            <select value={status} onChange={(e) => setStatus(e.target.value as ExpenseStatus)} className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]" style={inputStyle}>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="PAID">Paid</option>
            </select>
          </div>
        </div>

        <div>
          <label className={labelClass} style={labelStyle}>
            Notes
          </label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]" style={inputStyle} />
        </div>
      </form>
    </Drawer>
  );
}