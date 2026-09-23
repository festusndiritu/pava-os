'use client';

import { useEffect, useState } from 'react';
import { Plus, Receipt } from 'lucide-react';
import { expensesApi, type Expense, type ExpenseCategory, type ExpenseStatus } from '../../../lib/expenses-api';
import { ExpenseFormDrawer } from '../../../components/expenses/ExpenseFormDrawer';

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));
}
function money(n: number) {
  return `KSh ${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

const STATUS_STYLE: Record<ExpenseStatus, { label: string; fg: string; bg: string }> = {
  PENDING: { label: 'Pending', fg: 'var(--color-status-warn)', bg: 'var(--color-status-warnSoft)' },
  APPROVED: { label: 'Approved', fg: 'var(--color-status-ok)', bg: 'var(--color-status-okSoft)' },
  PAID: { label: 'Paid', fg: 'var(--color-ink-600)', bg: 'var(--color-bg)' },
};

const inputStyle = { borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-ink-900)' };

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[] | null>(null);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [categoryId, setCategoryId] = useState('');
  const [status, setStatus] = useState<ExpenseStatus | ''>('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);

  async function load() {
    setExpenses(await expensesApi.list({ categoryId: categoryId || undefined, status: status || undefined }));
  }

  useEffect(() => {
    expensesApi.categories().then(setCategories);
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryId, status]);

  const total = expenses?.reduce((s, e) => s + e.amount, 0) ?? 0;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight" style={{ color: 'var(--color-ink-900)' }}>
            Expenses
          </h1>
          <p className="mt-0.5 text-sm" style={{ color: 'var(--color-ink-600)' }}>
            Rent, utilities, repairs, and other operating costs.
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
          Add expense
        </button>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="rounded-md border px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]" style={inputStyle}>
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value as ExpenseStatus | '')} className="rounded-md border px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]" style={inputStyle}>
          <option value="">All statuses</option>
          <option value="PENDING">Pending</option>
          <option value="APPROVED">Approved</option>
          <option value="PAID">Paid</option>
        </select>
        {expenses && expenses.length > 0 && (
          <span className="ml-auto text-sm" style={{ color: 'var(--color-ink-600)' }}>
            Total: <span className="font-semibold data-num" style={{ color: 'var(--color-ink-900)' }}>{money(total)}</span>
          </span>
        )}
      </div>

      <div className="mt-5 overflow-hidden rounded-lg border" style={{ borderColor: 'var(--color-border)' }}>
        <table className="hidden w-full text-sm md:table">
          <thead>
            <tr className="border-b text-left" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)' }}>
              <th className="px-4 py-2.5 font-medium" style={{ color: 'var(--color-ink-600)' }}>
                Date
              </th>
              <th className="px-4 py-2.5 font-medium" style={{ color: 'var(--color-ink-600)' }}>
                Category
              </th>
              <th className="px-4 py-2.5 font-medium" style={{ color: 'var(--color-ink-600)' }}>
                Description
              </th>
              <th className="px-4 py-2.5 font-medium" style={{ color: 'var(--color-ink-600)' }}>
                Status
              </th>
              <th className="px-4 py-2.5 text-right font-medium" style={{ color: 'var(--color-ink-600)' }}>
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {expenses === null &&
              [...Array(5)].map((_, i) => (
                <tr key={i} className="border-b" style={{ borderColor: 'var(--color-border)' }}>
                  <td className="px-4 py-3" colSpan={5}>
                    <div className="h-4 w-2/3 animate-pulse rounded" style={{ backgroundColor: 'var(--color-border)' }} />
                  </td>
                </tr>
              ))}

            {expenses?.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center">
                  <Receipt size={28} strokeWidth={1.5} className="mx-auto mb-2" style={{ color: 'var(--color-ink-600)' }} />
                  <p className="text-sm font-medium" style={{ color: 'var(--color-ink-900)' }}>
                    No expenses recorded
                  </p>
                  <p className="mt-1 text-sm" style={{ color: 'var(--color-ink-600)' }}>
                    Log rent, utilities, or other operating costs to start tracking them.
                  </p>
                </td>
              </tr>
            )}

            {expenses?.map((e) => (
              <tr
                key={e.id}
                onClick={() => {
                  setEditing(e);
                  setFormOpen(true);
                }}
                className="cursor-pointer border-b transition-colors last:border-0 hover:bg-[var(--color-bg)]"
                style={{ borderColor: 'var(--color-border)' }}
              >
                <td className="px-4 py-3" style={{ color: 'var(--color-ink-600)' }}>
                  {fmtDate(e.date)}
                </td>
                <td className="px-4 py-3 font-medium" style={{ color: 'var(--color-ink-900)' }}>
                  {e.category?.name ?? '—'}
                </td>
                <td className="px-4 py-3" style={{ color: 'var(--color-ink-600)' }}>
                  {e.description || e.vendor || '—'}
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: STATUS_STYLE[e.status].bg, color: STATUS_STYLE[e.status].fg }}>
                    {STATUS_STYLE[e.status].label}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-medium data-num" style={{ color: 'var(--color-ink-900)' }}>
                  {money(e.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="divide-y divide-[var(--color-border)] md:hidden">
          {expenses?.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => {
                setEditing(e);
                setFormOpen(true);
              }}
              className="flex w-full flex-col gap-1 p-4 text-left active:bg-[var(--color-bg)]"
            >
              <div className="flex items-center justify-between">
                <p className="font-medium" style={{ color: 'var(--color-ink-900)' }}>
                  {e.category?.name ?? 'Uncategorised'}
                </p>
                <span className="data-num font-semibold" style={{ color: 'var(--color-ink-900)' }}>
                  {money(e.amount)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm" style={{ color: 'var(--color-ink-600)' }}>
                <span>{fmtDate(e.date)}</span>
                <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: STATUS_STYLE[e.status].bg, color: STATUS_STYLE[e.status].fg }}>
                  {STATUS_STYLE[e.status].label}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      <ExpenseFormDrawer
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={() => {
          load();
          expensesApi.categories().then(setCategories);
        }}
        expense={editing}
      />
    </div>
  );
}