'use client';

import { NumericInput } from '../ui/inputs';
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
}

export const emptyPayment: PaymentDraft = { mode: 'MPESA', cash: '', mpesa: '', changeAction: 'GIVE' };

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
 */
export function resolvePayment(draft: PaymentDraft, total: number, hasCustomer: boolean) {
  let tenders: PaymentLine[] | undefined;
  if (draft.mode === 'CASH' && num(draft.cash) > 0) tenders = [{ method: 'CASH', amount: num(draft.cash) }];
  if (draft.mode === 'SPLIT') {
    tenders = [
      ...(num(draft.cash) > 0 ? [{ method: 'CASH' as const, amount: num(draft.cash) }] : []),
      ...(num(draft.mpesa) > 0 ? [{ method: 'MPESA' as const, amount: num(draft.mpesa) }] : []),
    ];
  }
  const paid = tenders ? tenders.reduce((s, t) => s + t.amount, 0) : total;
  const over = Math.max(0, paid - total);
  const short = Math.max(0, total - paid);
  const cash = tenders?.find((t) => t.method === 'CASH')?.amount ?? 0;

  let problem: string | null = null;
  if (draft.mode === 'SPLIT' && !tenders?.length) problem = 'Enter what was paid';
  else if (short > 0) problem = `Short by ${money(short)}`;
  else if (over > 0 && draft.changeAction === 'CREDIT' && !hasCustomer) problem = 'Pick a customer to keep change on credit';
  else if (over > 0 && draft.changeAction === 'GIVE' && over > cash) problem = 'Change can only come out of cash';

  return {
    tenders,
    method: draft.mode === 'MPESA' || draft.mode === 'CASH' ? draft.mode : undefined,
    changeAction: over > 0 ? draft.changeAction : undefined,
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
  disabled,
}: {
  draft: PaymentDraft;
  onChange: (next: PaymentDraft) => void;
  total: number;
  hasCustomer: boolean;
  disabled?: boolean;
}) {
  const r = resolvePayment(draft, total, hasCustomer);
  const set = (patch: Partial<PaymentDraft>) => onChange({ ...draft, ...patch });
  const inputStyle = { borderColor: 'var(--color-border)', color: 'var(--color-ink-900)', backgroundColor: 'transparent' };

  return (
    <div className="flex flex-col gap-2">
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
              placeholder={draft.mode === 'CASH' ? String(total) : '0'}
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
                placeholder={String(Math.max(0, total - num(draft.cash)))}
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
                  onClick={() => set({ changeAction: o.value })}
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
            <p className="text-xs" style={{ color: 'var(--color-status-warn)' }}>
              Choose a customer above so the credit has an account to sit on.
            </p>
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
