import { IsIn, IsInt, Min } from 'class-validator';

// What a customer can hand over at the counter.
export const COUNTER_METHODS = ['CASH', 'MPESA'] as const;
export const CHANGE_ACTIONS = ['GIVE', 'CREDIT'] as const;

export class PaymentLineDto {
  @IsIn(COUNTER_METHODS)
  method!: (typeof COUNTER_METHODS)[number];

  @IsInt()
  @Min(1)
  amount!: number;
}
