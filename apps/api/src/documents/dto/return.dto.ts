import { ArrayMinSize, IsArray, IsIn, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

// Money goes back the way it came in at this till, or — for a sale with a
// customer on it — is left with the shop as that customer's credit.
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

  // Ignored for an account sale, which is credited back to the customer's
  // ledger rather than refunded at the counter.
  @IsOptional()
  @IsIn(REFUND_METHODS)
  refundMethod?: (typeof REFUND_METHODS)[number];

  @IsOptional()
  @IsString()
  reason?: string;
}