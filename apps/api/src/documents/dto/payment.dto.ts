import { IsIn, IsInt, Min } from 'class-validator';

// What a customer can hand over at the counter. Account credit (CREDIT) is
// not a counter payment — it is the ledger, handled elsewhere.
export const COUNTER_METHODS = ['CASH', 'MPESA'] as const;
export const CHANGE_ACTIONS = ['GIVE', 'CREDIT'] as const;

// One tender: how much the customer actually handed over by this method. For
// cash this may be more than is owed — the surplus is change.
export class PaymentLineDto {
  @IsIn(COUNTER_METHODS)
  method!: (typeof COUNTER_METHODS)[number];

  @IsInt()
  @Min(1)
  amount!: number;
}
