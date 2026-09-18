import { ArrayMinSize, IsArray, IsBoolean, IsIn, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ConvertToInvoiceDto {
  // Backorder promise (brief step 3): converts a quote to an invoice even
  // though recorded stock is short. Backend re-checks the actor actually
  // holds `canInvoiceWithoutStock` (or is admin) regardless of this flag.
  @IsOptional()
  @IsBoolean()
  allowNegativeStock?: boolean;
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

  @IsNumber()
  @Min(0.001)
  qty!: number;

  // The final, negotiated per-unit price — see PosItemDto for why there's
  // no separate "discount" field. Same rule here.
  @IsNumber()
  @Min(0)
  unitPrice!: number;
}

export class ManualAllocationDto {
  @IsString()
  productId!: string;

  @IsNumber()
  @Min(0)
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

  // true (default): transport folded into item prices, "Delivery included"
  // on the quote. false: transport shown as its own line, item prices untouched.
  @IsOptional()
  @IsBoolean()
  foldTransportIntoPrices?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(1)
  roundingIncrement?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}