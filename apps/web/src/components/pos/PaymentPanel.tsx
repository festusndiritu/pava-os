'use client';

import { FormEvent, useEffect, useState } from 'react';
import { NumericInput, PhoneInput } from '../ui/inputs';
import { Modal } from '../ui/Modal';
import { toast } from '../ui/Toast';
import { ApiError } from '../../lib/api';
import { customersApi, type Customer } from '../../lib/customers-api';
import { money } from '../../lib/format';
import type { PaymentLine, PosPaymentMethod } from '../../lib/pos-api';

export type PayMode = PosPaymentMethod | 'SPLIT';
export type ChangeAction = 'GIVE' | 'CREDIT';

export interface PaymentDraft {
  mode: PayMode;
  /** Cash the customer handed over (may exceed the bill). */
  cash: string;
  /** M-Pesa received, for a split sale. */
  mpesa: string;
  changeAction: ChangeAction;
  /** Pay as much of the bill as possible out of credit the customer already holds. */
  useCredit: boolean;
}

export const emptyPayment: PaymentDraft = { mode: 'MPESA', cash: '', mpesa: '', changeAction: 'GIVE', useCredit: false };

const MODES: { value: PayMode; label: string; hint: string }[] = [
  { value: 'MPESA', label: 'M-Pesa', hint: 'Paybill' },
  { value: 'CASH', label: 'Cash', hint: 'Counter' },
  { value: 'SPLIT', label: 'Cash + M-Pesa', hint: 'Both' },
];

const num = (s: string) => parseInt(s, 10) || 0;

/**
 * What the draft means for the bill. The total here is the till's estimate —
 * the server prices the sale and has the last word — so `over` and `short` are
 * a guide for the operator, and a refusal from the server shows the real figure.
 *
 * Held credit comes off the bill first; what is left (`due`) is what has to be
 * handed over.
 */
export function resolvePayment(draft: PaymentDraft, total: number, hasCustomer: boolean, creditAvailable = 0) {
  const credit = draft.useCredit && hasCustomer ? Math.max(0, Math.min(creditAvailable, total)) : 0;
  const due = total - credit;

  let tenders: PaymentLine[] | undefined;
  if (draft.mode === 'CASH' && num(draft.cash) > 0) tenders = [{ method: 'CASH', amount: num(draft.cash) }];
  if (draft.mode === 'SPLIT') {
    tenders = [
      ...(num(draft.cash) > 0 ? [{ method: 'CASH' as const, amount: num(draft.cash) }] : []),
      ...(num(draft.mpesa) > 0 ? [{ method: 'MPESA' as const, amount: num(draft.mpesa) }] : []),
    ];
  }
  const paid = tenders ? tenders.reduce((s, t) => s + t.amount, 0) : due;
  const over = Math.max(0, paid - due);
  const short = Math.max(0, due - paid);
  const cash = tenders?.find((t) => t.method === 'CASH')?.amount ?? 0;

  let problem: string | null = null;
  if (draft.mode === 'SPLIT' && !tenders?.length && due > 0) problem = 'Enter what was paid';
  else if (short > 0) problem = `Short by ${money(short)}`;
  else if (over > 0 && draft.changeAction === 'CREDIT' && !hasCustomer) problem = 'Pick a customer to keep change on credit';
  else if (over > 0 && draft.changeAction === 'GIVE' && over > cash) problem = 'Change can only come out of cash';

  return {
    tenders,
    method: draft.mode === 'MPESA' || draft.mode === 'CASH' ? draft.mode : undefined,
    changeAction: over > 0 ? draft.changeAction : undefined,
    creditApplied: credit,
    due,
    over,
    short,
    problem,
  };
}

export function PaymentPanel({
  draft,
  onChange,
  total,
  hasCustomer,
  creditAvailable = 0,
  onNeedCustomer,
  disabled,
}: {
  draft: PaymentDraft;
  onChange: (next: PaymentDraft) => void;
  total: number;
  hasCustomer: boolean;
  /** Credit the selected customer already holds with the shop. */
  creditAvailable?: number;
  /** Asked for when change is to be kept as credit but nobody is on the sale yet. */
  onNeedCustomer?: () => void;
  disabled?: boolean;
}) {
  const r = resolvePayment(draft, total, hasCustomer, creditAvailable);
  const set = (patch: Partial<PaymentDraft>) => onChange({ ...draft, ...patch });
  const inputStyle = { borderColor: 'var(--color-border)', color: 'var(--color-ink-900)', backgroundColor: 'transparent' };

  return (
    <div className="flex flex-col gap-2">
      {!disabled && hasCustomer && creditAvailable > 0 && (
        <button
          type="button"
          aria-pressed={draft.useCredit}
          onClick={() => set({ useCredit: !draft.useCredit })}
          className="flex min-h-11 items-center justify-between gap-3 rounded-md border px-3 text-left text-sm"
          style={{
            borderColor: draft.useCredit ? 'var(--color-status-ok)' : 'var(--color-border)',
            backgroundColor: draft.useCredit ? 'var(--color-status-okSoft)' : 'transparent',
            color: draft.useCredit ? 'var(--color-status-ok)' : 'var(--color-ink-600)',
          }}
        >
          <span>
            Credit held
            <span className="data-num ml-1.5 font-semibold">{money(creditAvailable)}</span>
          </span>
          <span className="data-num text-xs font-medium">{draft.useCredit ? `Using ${money(r.creditApplied)}` : 'Use it'}</span>
        </button>
      )}
      {!disabled && r.creditApplied > 0 && r.due === 0 && (
        <p className="text-xs" style={{ color: 'var(--color-status-ok)' }}>
          Covered by the customer&apos;s credit — nothing more to collect.
        </p>
      )}

      <div className="grid grid-cols-3 gap-2">
        {MODES.map((m) => {
          const active = !disabled && draft.mode === m.value;
          return (
            <button
              key={m.value}
              type="button"
              onClick={() => set({ mode: m.value })}
              className="min-h-11 rounded-md border px-1 text-sm font-medium leading-tight"
              style={{
                borderColor: active ? 'var(--color-accent)' : 'var(--color-border)',
                backgroundColor: active ? 'var(--color-accent-soft)' : 'transparent',
                color: active ? 'var(--color-accent)' : 'var(--color-ink-600)',
              }}
            >
              {m.label}
              <span className="block text-[11px] font-normal opacity-70">{m.hint}</span>
            </button>
          );
        })}
      </div>

      {!disabled && draft.mode !== 'MPESA' && (
        <div className="flex flex-col gap-2">
          <label className="flex items-center justify-between gap-3 text-sm" style={{ color: 'var(--color-ink-600)' }}>
            {draft.mode === 'CASH' ? 'Cash received (optional)' : 'Cash'}
            <NumericInput
              value={draft.cash}
              onChange={(cash) => set({ cash })}
              placeholder={draft.mode === 'CASH' ? String(r.due) : '0'}
              aria-label="Cash received"
              className="data-num min-h-10 w-36 rounded-md border px-2 text-right"
              style={inputStyle}
            />
          </label>
          {draft.mode === 'SPLIT' && (
            <label className="flex items-center justify-between gap-3 text-sm" style={{ color: 'var(--color-ink-600)' }}>
              M-Pesa
              <NumericInput
                value={draft.mpesa}
                onChange={(mpesa) => set({ mpesa })}
                placeholder={String(Math.max(0, r.due - num(draft.cash)))}
                aria-label="M-Pesa received"
                className="data-num min-h-10 w-36 rounded-md border px-2 text-right"
                style={inputStyle}
              />
            </label>
          )}
        </div>
      )}

      {!disabled && r.over > 0 && (
        <div className="flex flex-col gap-2 rounded-md border p-2" style={{ borderColor: 'var(--color-border)' }}>
          <div className="flex items-baseline justify-between text-sm">
            <span style={{ color: 'var(--color-ink-600)' }}>Change</span>
            <span className="data-num font-semibold" style={{ color: 'var(--color-ink-900)' }}>
              {money(r.over)}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                { value: 'GIVE', label: 'Give back' },
                { value: 'CREDIT', label: 'Keep on credit' },
              ] as const
            ).map((o) => {
              const active = draft.changeAction === o.value;
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => {
                    set({ changeAction: o.value });
                    if (o.value === 'CREDIT' && !hasCustomer) onNeedCustomer?.();
                  }}
                  className="min-h-10 rounded-md border px-2 text-sm font-medium"
                  style={{
                    borderColor: active ? 'var(--color-accent)' : 'var(--color-border)',
                    backgroundColor: active ? 'var(--color-accent-soft)' : 'transparent',
                    color: active ? 'var(--color-accent)' : 'var(--color-ink-600)',
                  }}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
          {draft.changeAction === 'CREDIT' && !hasCustomer && (
            <button type="button" onClick={onNeedCustomer} className="text-left text-xs underline" style={{ color: 'var(--color-status-warn)' }}>
              The credit needs a customer account to sit on — add one now
            </button>
          )}
        </div>
      )}

      {!disabled && r.short > 0 && (
        <p className="text-xs" style={{ color: 'var(--color-status-warn)' }}>
          {r.problem}
        </p>
      )}
    </div>
  );
}

const dialogInput = { borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-ink-900)' };

/**
 * A walk-in leaves part of what they paid with the shop: it has to sit on a
 * customer, so make one without leaving the till. A number that is already on
 * file offers that person instead of a second account.
 */
export function QuickCustomerDialog({
  initialName,
  amount,
  onClose,
  onCreated,
}: {
  initialName?: string;
  /** What is about to be kept on credit, shown so it is clear what the account is for. */
  amount?: number;
  onClose: () => void;
  onCreated: (customer: Customer) => void;
}) {
  const [name, setName] = useState(initialName ?? '');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [match, setMatch] = useState<Customer | null>(null);

  useEffect(() => {
    if (!/^(07|01)\d{8}$/.test(phone)) {
      setMatch(null);
      return;
    }
    let stale = false;
    customersApi
      .list(phone)
      .then((rows) => !stale && setMatch(rows.find((c) => c.phone === phone) ?? null))
      .catch(() => {});
    return () => {
      stale = true;
    };
  }, [phone]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      onCreated(await customersApi.create({ name: name.trim(), phone: phone || undefined }));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't add the customer");
      setSaving(false);
    }
  }

  return (
    <Modal onClose={onClose} placement="center" dismissOnBackdrop={false} label="Add customer" className="max-w-sm p-5">
      <form onSubmit={submit}>
        <h3 className="text-sm font-semibold" style={{ color: 'var(--color-ink-900)' }}>
          Add a customer
        </h3>
        <p className="mt-1 text-xs" style={{ color: 'var(--color-ink-600)' }}>
          {amount ? `${money(amount)} will be kept on their account for next time.` : 'Their change will be kept on this account.'}
        </p>

        <div className="mt-4 flex flex-col gap-3">
          <input
            data-autofocus
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
            aria-label="Name"
            className="min-h-11 w-full rounded-md border px-3 text-sm outline-none focus:border-[var(--color-accent)]"
            style={dialogInput}
          />
          <PhoneInput
            value={phone}
            onChange={setPhone}
            aria-label="Phone"
            className="min-h-11 w-full rounded-md border px-3 text-sm outline-none focus:border-[var(--color-accent)]"
            style={dialogInput}
          />
          {match && (
            <button
              type="button"
              onClick={() => onCreated(match)}
              className="rounded-md border px-3 py-2 text-left text-sm"
              style={{ borderColor: 'var(--color-status-warn)', backgroundColor: 'var(--color-status-warnSoft)', color: 'var(--color-status-warn)' }}
            >
              That number is already {match.businessName || match.name}. Tap to use them instead.
            </button>
          )}
        </div>

        <div className="mt-4 flex gap-2">
          <button type="button" onClick={onClose} className="min-h-11 flex-1 rounded-md border px-4 text-sm font-medium" style={{ borderColor: 'var(--color-border)', color: 'var(--color-ink-900)' }}>
            Cancel
          </button>
          <button type="submit" disabled={saving || !name.trim()} className="min-h-11 flex-1 rounded-md px-4 text-sm font-semibold text-white disabled:opacity-50" style={{ backgroundColor: 'var(--color-accent)' }}>
            {saving ? 'Adding…' : 'Add & keep credit'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
