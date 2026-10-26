import { ArrayMinSize, IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, MaxLength, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { IsMoney } from '../../common/validation/money.validator.js';
import { CHANGE_ACTIONS, PaymentLineDto } from './payment.dto.js';

export class PosItemDto {
  @IsString()
  productId!: string;

  // PAVA sells whole units only — no half-kilos, no half lengths.
  @IsInt()
  @Min(1)
  qty!: number;

  // The final, negotiated per-unit price the operator agreed with the customer — not a "list price"
  // with a separate discount subtracted from it.
  @IsMoney()
  unitPrice!: number;

  // How many of `qty` come out of the shop's own stock; the rest is supplied from elsewhere and
  // never touches shop inventory.
  @IsOptional()
  @IsInt()
  @Min(0)
  stockQty?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  supplierSource?: string;
}

export class ManualAllocationDto {
  @IsString()
  productId!: string;

  @IsMoney()
  amount!: number;
}

const TRANSPORT_ALLOCATIONS = ['QUANTITY', 'VALUE', 'MANUAL'] as const;
// The till takes M-Pesa Paybill (the norm) and cash.
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
  transportApplyTo?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ManualAllocationDto)
  manualAllocations?: ManualAllocationDto[];

  @IsOptional()
  @IsBoolean()
  foldTransportIntoPrices?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  roundingIncrement?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  discount?: number;

  // Optional only because a settle-later sale has not been paid yet.
  @IsOptional()
  @IsIn(PAYMENT_METHODS)
  paymentMethod?: (typeof PAYMENT_METHODS)[number];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PaymentLineDto)
  payments?: PaymentLineDto[];

  @IsOptional()
  @IsIn(CHANGE_ACTIONS)
  changeAction?: (typeof CHANGE_ACTIONS)[number];

  // How much of the bill to pay out of credit the customer already holds with the shop.
  @IsOptional()
  @IsInt()
  @Min(1)
  creditApplied?: number;

  @IsOptional()
  @IsBoolean()
  allowNegativeStock?: boolean;

  // Goods handed over now, settled later the same day (PAVA's only form of credit).
  @IsOptional()
  @IsBoolean()
  settleLater?: boolean;

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
