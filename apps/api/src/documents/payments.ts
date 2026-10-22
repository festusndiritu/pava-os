import { BadRequestException } from '@nestjs/common';
import { PaymentMethod } from '../../generated/prisma/client.js';

export type TenderInput = { method: 'CASH' | 'MPESA'; amount: number };

export type SettledPayments = {
  rows: { method: PaymentMethod; amount: number }[];
  paymentMethod: PaymentMethod;
  changeGiven: number;
  changeToCredit: number;
  creditApplied: number;
};

/** Turns what the customer handed over into what is stored against the bill. */
export function settlePayments(
  total: number,
  tenders: TenderInput[] | undefined,
  fallbackMethod: 'CASH' | 'MPESA' | undefined,
  changeAction: 'GIVE' | 'CREDIT' = 'GIVE',
  hasCustomer: boolean,
  creditRequested = 0,
): SettledPayments {
  if (creditRequested > 0 && !hasCustomer) throw new BadRequestException('Select a customer to use their credit');
  const credit = Math.min(Math.max(0, creditRequested), total);
  const due = total - credit;

  const input: TenderInput[] = tenders?.length ? tenders : fallbackMethod && due > 0 ? [{ method: fallbackMethod, amount: due }] : [];
  if (input.length === 0 && due > 0) throw new BadRequestException('Choose how the customer paid');

  const byMethod = new Map<'CASH' | 'MPESA', number>();
  for (const t of input) {
    if (!Number.isInteger(t.amount) || t.amount <= 0) throw new BadRequestException('Each payment must be a whole amount above zero');
    byMethod.set(t.method, (byMethod.get(t.method) || 0) + t.amount);
  }

  const paid = [...byMethod.values()].reduce((a, b) => a + b, 0);
  if (paid < due) {
    throw new BadRequestException(`Payments add up to KSh ${paid}, which is short of the KSh ${due} still to pay`);
  }

  const surplus = paid - due;
  const cash = byMethod.get('CASH') || 0;
  if (surplus > 0) {
    if (changeAction === 'CREDIT' && !hasCustomer) {
      throw new BadRequestException('Select a customer to leave the change on their credit');
    }
    if (changeAction === 'GIVE' && surplus > cash) {
      throw new BadRequestException('Change can only be given out of cash — the amount over the bill is more than the cash paid');
    }
  }

  // Take the surplus off cash first, then (only when it is being left as credit) off whatever else was paid.
  let remaining = surplus;
  const rows: { method: PaymentMethod; amount: number }[] = [];
  for (const method of ['CASH', 'MPESA'] as const) {
    const gross = byMethod.get(method);
    if (!gross) continue;
    const take = Math.min(remaining, gross);
    remaining -= take;
    if (gross - take > 0) rows.push({ method: method as PaymentMethod, amount: gross - take });
  }

  if (credit > 0) rows.push({ method: PaymentMethod.STORE_CREDIT, amount: credit });

  return {
    rows,
    paymentMethod: rows.length > 1 ? PaymentMethod.MIXED : rows[0]?.method ?? PaymentMethod.CASH,
    changeGiven: changeAction === 'GIVE' ? surplus : 0,
    changeToCredit: changeAction === 'CREDIT' ? surplus : 0,
    creditApplied: credit,
  };
}
