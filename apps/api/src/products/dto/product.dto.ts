import { IsArray, IsBoolean, IsIn, IsNumber, IsOptional, IsString, Length, Min } from 'class-validator';

const STOCK_STATUSES = ['IN_STOCK', 'SUPPLIER_ONLY', 'OUT_OF_STOCK'] as const;

export class CreateProductDto {
  @IsString()
  @Length(1, 160)
  name!: string;

  @IsOptional()
  @IsString()
  @Length(1, 160)
  displayName?: string;

  @IsOptional()
  @IsString()
  spec?: string;

  @IsOptional()
  @IsString()
  brandId?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsString()
  unitId!: string;

  @IsNumber()
  @Min(0)
  basePrice!: number;

  @IsOptional()
  @IsIn(STOCK_STATUSES)
  stockStatus?: (typeof STOCK_STATUSES)[number];

  @IsOptional()
  @IsString()
  shape?: string;

  @IsOptional()
  @IsString()
  nominalSize?: string;

  @IsOptional()
  @IsNumber()
  widthMm?: number;

  @IsOptional()
  @IsNumber()
  heightMm?: number;

  @IsOptional()
  @IsNumber()
  thicknessMm?: number;

  @IsOptional()
  @IsNumber()
  gauge?: number;

  @IsOptional()
  @IsString()
  material?: string;

  @IsOptional()
  @IsString()
  familyId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  aliases?: string[];
}

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @Length(1, 160)
  name?: string;

  @IsOptional()
  @IsString()
  @Length(1, 160)
  displayName?: string;

  @IsOptional()
  @IsString()
  spec?: string;

  @IsOptional()
  @IsString()
  brandId?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  unitId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  basePrice?: number;

  @IsOptional()
  @IsIn(STOCK_STATUSES)
  stockStatus?: (typeof STOCK_STATUSES)[number];

  @IsOptional()
  @IsString()
  shape?: string;

  @IsOptional()
  @IsString()
  nominalSize?: string;

  @IsOptional()
  @IsNumber()
  widthMm?: number;

  @IsOptional()
  @IsNumber()
  heightMm?: number;

  @IsOptional()
  @IsNumber()
  thicknessMm?: number;

  @IsOptional()
  @IsNumber()
  gauge?: number;

  @IsOptional()
  @IsString()
  material?: string;

  @IsOptional()
  @IsString()
  familyId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  aliases?: string[];

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}