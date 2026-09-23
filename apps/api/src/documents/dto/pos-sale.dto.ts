import { ArrayMinSize, IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { IsMoney } from '../../common/validation/money.validator.js';

export class PosItemDto {
  @IsString()
  productId!: string;

  // PAVA sells whole units only — no half-kilos, no half lengths.
  @IsInt()
  @Min(1)
  qty!: number;

  // The final, negotiated per-unit price the operator agreed with the
  // customer — not a "list price" with a separate discount subtracted from
  // it. If it's below the product's current base price, the backend derives
  // the implied discount itself (against the authoritative product price)
  // for permission-limit enforcement and reporting; the client cannot spoof
  // a fake "before" price to dodge the discount-limit check.
  @IsMoney()
  unitPrice!: number;
}

export class ManualAllocationDto {
  @IsString()
  productId!: string;

  @IsMoney()
  amount!: number;
}

const TRANSPORT_ALLOCATIONS = ['QUANTITY', 'VALUE', 'MANUAL'] as const;
// The till takes M-Pesa Paybill (the norm) and cash. Account sales are
// raised through the quote -> invoice flow, which posts to the customer's
// credit ledger; they are not a POS payment method.
const PAYMENT_METHODS = ['CASH', 'MPESA'] as const;

export class CreatePosSaleDto {
  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  customerName?: string; // walk-in, no Customer record required

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PosItemDto)
  items!: PosItemDto[];

  @IsOptional()
  @IsMoney()
  transportAmount?: number;

  @IsOptional()
  @IsIn(TRANSPORT_ALLOCATIONS)
  transportAllocation?: (typeof TRANSPORT_ALLOCATIONS)[number];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  transportApplyTo?: string[]; // productIds; defaults to all lines

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ManualAllocationDto)
  manualAllocations?: ManualAllocationDto[];

  // true (default): transport folded into item prices, "Delivery included" on the receipt.
  // false: transport shown as its own line, item prices untouched.
  @IsOptional()
  @IsBoolean()
  foldTransportIntoPrices?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  roundingIncrement?: number;

  // Optional only because a settle-later sale has not been paid yet.
  @IsOptional()
  @IsIn(PAYMENT_METHODS)
  paymentMethod?: (typeof PAYMENT_METHODS)[number];

  @IsOptional()
  @IsBoolean()
  allowNegativeStock?: boolean;

  // Goods handed over now, settled later the same day (PAVA's only form of
  // credit). The sale is raised as an unpaid invoice: stock leaves, no
  // payment method is recorded yet, and it is closed off with Mark paid.
  @IsOptional()
  @IsBoolean()
  settleLater?: boolean;

  // Set when the cart was resumed from a suspended order — that held order
  // is deleted in the same transaction that commits this sale.
  @IsOptional()
  @IsString()
  suspendedFromId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class SuspendOrderDto {
  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  customerName?: string;

  // Short operator-supplied handle ("blue pickup", "Mwangi site") so a held
  // order can be picked out of the list at a glance.
  @IsOptional()
  @IsString()
  label?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PosItemDto)
  items!: PosItemDto[];

  @IsOptional()
  @IsMoney()
  transportAmount?: number;

  @IsOptional()
  @IsBoolean()
  foldTransportIntoPrices?: boolean;
}
