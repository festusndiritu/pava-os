import { ArrayMinSize, IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, MaxLength, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { IsMoney } from '../../common/validation/money.validator.js';
import { CHANGE_ACTIONS, PaymentLineDto } from './payment.dto.js';
import { OptionalKenyanPhone } from '../../common/validation/phone.validator.js';

export class FulfilmentLineDto {
  @IsString()
  itemId!: string;

  @IsInt()
  @Min(0)
  stockQty!: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  supplierSource?: string;
}

export class ConvertToInvoiceDto {
  @IsOptional()
  @IsBoolean()
  allowNegativeStock?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FulfilmentLineDto)
  fulfilment?: FulfilmentLineDto[];
}

export class CreateDeliveryNoteDto {
  // Dispatch/site address for this note — distinct from the customer's stored address (delivery
  // site and billing address aren't always the same).
  @IsOptional()
  @IsString()
  deliveryLocation?: string;

  // A contact number for whoever's at the drop-off site — often not the customer themselves.
  @OptionalKenyanPhone()
  deliveryPhone?: string;
}

export class MarkPaidDto {
  // The bill is settled for this much less than its total.
  @IsOptional()
  @IsInt()
  @Min(0)
  discount?: number;

  // How the outstanding invoice was actually settled, so the receipt says so.
  @IsOptional()
  @IsIn(['CASH', 'MPESA'] as const)
  paymentMethod?: 'CASH' | 'MPESA';

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PaymentLineDto)
  payments?: PaymentLineDto[];

  @IsOptional()
  @IsIn(CHANGE_ACTIONS)
  changeAction?: (typeof CHANGE_ACTIONS)[number];
}

export class DocumentItemDto {
  @IsOptional()
  @IsString()
  productId?: string;

  // Required for a manual/custom line with no productId (e.g.
  @IsOptional()
  @IsString()
  description?: string;

  // PAVA sells whole units only — no half-kilos, no half lengths.
  @IsInt()
  @Min(1)
  qty!: number;

  // The final, negotiated per-unit price — see PosItemDto for why there's no separate "discount" field.
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

export class CreateDocumentDto {
  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  customerName?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => DocumentItemDto)
  items!: DocumentItemDto[];

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

  // Taken off the whole bill after line prices are set.
  @IsOptional()
  @IsInt()
  @Min(0)
  discount?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

// Editing a quote is a full replacement of everything the create form captures (customer, lines,
// transport, notes) — the same shape and the same validation as creating one, so the two can never
// drift apart.
export class UpdateDocumentDto extends CreateDocumentDto {}
