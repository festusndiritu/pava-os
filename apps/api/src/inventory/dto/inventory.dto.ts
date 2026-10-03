import { ArrayMinSize, IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { IsMoney } from '../../common/validation/money.validator.js';

export class ReceiveLineDto {
  @IsString()
  productId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsMoney()
  unitCost!: number;
}

export class ReceiveInventoryDto {
  @IsString()
  supplier!: string;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReceiveLineDto)
  lines!: ReceiveLineDto[];
}

// DAMAGE and LOSS only ever reduce stock; RETURN only ever adds it. The service enforces the direction.
const ADJUST_TYPES = ['ADJUSTMENT', 'CORRECTION', 'RETURN', 'DAMAGE', 'LOSS'] as const;

export class AdjustInventoryDto {
  @IsString()
  productId!: string;

  @IsInt()
  quantity!: number; // signed, whole units

  @IsIn(ADJUST_TYPES)
  type!: (typeof ADJUST_TYPES)[number];

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsBoolean()
  allowNegative?: boolean;

  // What the added units cost, per unit. Only used when quantity > 0; without
  // it the new lot is costed at the product's last known cost (or 0 if none).
  @IsOptional()
  @IsMoney()
  unitCost?: number;
}

export class OpeningBalanceDto {
  @IsString()
  productId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsMoney()
  unitCost!: number;
}