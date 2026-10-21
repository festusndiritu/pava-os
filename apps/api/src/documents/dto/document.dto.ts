import { ArrayMinSize, IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, MaxLength, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { IsMoney } from '../../common/validation/money.validator.js';
import { CHANGE_ACTIONS, PaymentLineDto } from './payment.dto.js';
import { OptionalKenyanPhone } from '../../common/validation/phone.validator.js';

// Where one invoice line is supplied from: how many units leave the shop's own
// stock, and (for the rest) where they come from.
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
  // Backorder promise (brief step 3): converts a quote to an invoice even
  // though recorded stock is short. Backend re-checks the actor actually
  // holds `canInvoiceWithoutStock` (or is admin) regardless of this flag.
  @IsOptional()
  @IsBoolean()
  allowNegativeStock?: boolean;

  // Per-line split between shop stock and goods supplied from elsewhere.
  // A line left out is taken wholly from the shop.
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FulfilmentLineDto)
  fulfilment?: FulfilmentLineDto[];
}

export class CreateDeliveryNoteDto {
  // Dispatch/site address for this note — distinct from the customer's
  // stored address (delivery site and billing address aren't always the
  // same). Optional: falls back to the customer's stored address at render
  // time when omitted.
  @IsOptional()
  @IsString()
  deliveryLocation?: string;

  // A contact number for whoever's at the drop-off site — often not the
  // customer themselves. Optional: falls back to the customer's stored
  // phone at render time when omitted.
  @OptionalKenyanPhone()
  deliveryPhone?: string;
}

export class MarkPaidDto {
  // How the outstanding invoice was actually settled, so the receipt says
  // so. Optional for invoices raised before this was recorded.
  @IsOptional()
  @IsIn(['CASH', 'MPESA'] as const)
  paymentMethod?: 'CASH' | 'MPESA';

  // Cash that needed change, or a cash + M-Pesa split — see CreatePosSaleDto.
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

  // Required for a manual/custom line with no productId (e.g. a one-off
  // labour charge); ignored for a catalogue line, whose description is
  // taken from the product itself so it can't drift from the catalogue.
  @IsOptional()
  @IsString()
  description?: string;

  // PAVA sells whole units only — no half-kilos, no half lengths.
  @IsInt()
  @Min(1)
  qty!: number;

  // The final, negotiated per-unit price — see PosItemDto for why there's
  // no separate "discount" field. Same rule here.
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
  transportApplyTo?: string[]; // productIds; defaults to all lines

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ManualAllocationDto)
  manualAllocations?: ManualAllocationDto[];

  // true (default): transport folded into item prices, "Delivery included"
  // on the quote. false: transport shown as its own line, item prices untouched.
  @IsOptional()
  @IsBoolean()
  foldTransportIntoPrices?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  roundingIncrement?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

// Editing a quote is a full replacement of everything the create form
// captures (customer, lines, transport, notes) — the same shape and the same
// validation as creating one, so the two can never drift apart. Anything left
// out is cleared, exactly as it would be on a fresh quote.
export class UpdateDocumentDto extends CreateDocumentDto {}
