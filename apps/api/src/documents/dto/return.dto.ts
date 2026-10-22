import { ArrayMinSize, IsArray, IsIn, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

const REFUND_METHODS = ['CASH', 'MPESA', 'STORE_CREDIT'] as const;

export class ReturnItemDto {
  @IsString()
  documentItemId!: string;

  @IsInt()
  @Min(1)
  qty!: number;
}

export class CreateReturnDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReturnItemDto)
  items!: ReturnItemDto[];

  @IsOptional()
  @IsIn(REFUND_METHODS)
  refundMethod?: (typeof REFUND_METHODS)[number];

  @IsOptional()
  @IsString()
  reason?: string;
}