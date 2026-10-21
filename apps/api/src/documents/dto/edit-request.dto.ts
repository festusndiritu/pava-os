import { ArrayMinSize, IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { IsMoney } from '../../common/validation/money.validator.js';
import { ManualAllocationDto } from './document.dto.js';

// One line of the corrected document. `itemId` ties it to the existing line
// it replaces (so what was supplied from the shop vs elsewhere carries over);
// leave it out for a line that is being added.
export class EditRequestItemDto {
  @IsOptional()
  @IsString()
  itemId?: string;

  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsInt()
  @Min(1)
  qty!: number;

  @IsMoney()
  unitPrice!: number;
}

// Only items, quantities, prices and transport can be corrected. The customer,
// payment method and notes stay as issued.
export class CreateEditRequestDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => EditRequestItemDto)
  items!: EditRequestItemDto[];

  @IsOptional()
  @IsMoney()
  transportAmount?: number;

  @IsOptional()
  @IsIn(['QUANTITY', 'VALUE', 'MANUAL'] as const)
  transportAllocation?: 'QUANTITY' | 'VALUE' | 'MANUAL';

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
}

export class DecideEditRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  // Needed only when approving a change to an already-paid sale whose total
  // moves: how the difference was collected, or how it is given back.
  // CREDIT (refund only) leaves the difference on the customer's credit.
  @IsOptional()
  @IsIn(['CASH', 'MPESA', 'CREDIT'] as const)
  settlement?: 'CASH' | 'MPESA' | 'CREDIT';
}
