import { ArrayMinSize, IsArray, IsIn, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

const TRANSPORT_MODES = ['NONE', 'ITEMIZED', 'DISTRIBUTED'] as const;

export class DocumentItemDto {
  @IsOptional()
  @IsString()
  productId?: string;

  @IsString()
  description!: string;

  @IsNumber()
  @Min(0.001)
  qty!: number;

  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discount?: number;
}

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
  @IsIn(TRANSPORT_MODES)
  transportMode?: (typeof TRANSPORT_MODES)[number];

  @IsOptional()
  @IsNumber()
  @Min(0)
  transportAmount?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}