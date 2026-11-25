import { ArrayMinSize, IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { IsMoney } from '../../common/validation/money.validator.js';
import { ManualAllocationDto } from './document.dto.js';

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

// How much of one line (by its position in `items`) leaves the shop's own shelf; the rest is marked as from elsewhere.
export class EditFulfilmentDto {
  @IsInt()
  @Min(0)
  index!: number;

  @IsInt()
  @Min(0)
  stockQty!: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  supplierSource?: string;
}

// Only items, quantities, prices, transport and where the goods come from can be corrected.
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

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EditFulfilmentDto)
  lineSourcing?: EditFulfilmentDto[];
}

export class DecideEditRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  // Needed only when approving a change to an already-paid sale whose total moves: how the
  // difference was collected, or how it is given back.
  @IsOptional()
  @IsIn(['CASH', 'MPESA', 'CREDIT'] as const)
  settlement?: 'CASH' | 'MPESA' | 'CREDIT';

  // Approve even when the shelf can't cover the added units; the part not taken from the shelf is
  // marked as sourced elsewhere (a backorder), like invoicing beyond stock. `fulfilment` overrides
  // the requester's `lineSourcing`; without either, whatever the shelf holds is taken.
  @IsOptional()
  @IsBoolean()
  allowShortfall?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EditFulfilmentDto)
  fulfilment?: EditFulfilmentDto[];

  @IsOptional()
  @IsString()
  @MaxLength(120)
  supplierSource?: string;
}
