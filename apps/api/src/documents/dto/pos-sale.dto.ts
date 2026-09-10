import { ArrayMinSize, IsArray, IsBoolean, IsIn, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class PosItemDto {
  @IsString()
  productId!: string;

  @IsNumber()
  @Min(0.001)
  qty!: number;

  @IsNumber()
  @Min(0)
  unitPrice!: number; // base price before transport/rounding — the price the operator agreed with the customer

  @IsOptional()
  @IsNumber()
  @Min(0)
  discount?: number; // flat KSh amount for this line
}

export class ManualAllocationDto {
  @IsString()
  productId!: string;

  @IsNumber()
  @Min(0)
  amount!: number;
}

const TRANSPORT_ALLOCATIONS = ['QUANTITY', 'VALUE', 'MANUAL'] as const;
const PAYMENT_METHODS = ['CASH', 'MPESA', 'CARD', 'CREDIT'] as const;

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
  @IsNumber()
  @Min(0)
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
  @IsNumber()
  @Min(1)
  roundingIncrement?: number;

  @IsIn(PAYMENT_METHODS)
  paymentMethod!: (typeof PAYMENT_METHODS)[number];

  @IsOptional()
  @IsBoolean()
  allowNegativeStock?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;
}