import { ArrayMinSize, IsArray, IsBoolean, IsIn, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ReceiveLineDto {
  @IsString()
  productId!: string;

  @IsNumber()
  @Min(0.001)
  quantity!: number;

  @IsNumber()
  @Min(0)
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

const ADJUST_TYPES = ['ADJUSTMENT', 'CORRECTION', 'RETURN'] as const;

export class AdjustInventoryDto {
  @IsString()
  productId!: string;

  @IsNumber()
  quantity!: number; // signed

  @IsIn(ADJUST_TYPES)
  type!: (typeof ADJUST_TYPES)[number];

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsBoolean()
  allowNegative?: boolean;
}

export class OpeningBalanceDto {
  @IsString()
  productId!: string;

  @IsNumber()
  @Min(0.001)
  quantity!: number;

  @IsNumber()
  @Min(0)
  unitCost!: number;
}