import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { OptionalKenyanPhone } from '../../common/validation/phone.validator.js';

export class UpdateSettingsDto {
  @IsOptional()
  @IsString()
  businessName?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @OptionalKenyanPhone()
  phone?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  quotePrefix?: string;

  @IsOptional()
  @IsString()
  invoicePrefix?: string;

  @IsOptional()
  @IsString()
  receiptPrefix?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  roundingIncrement?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  lowStockThreshold?: number;

  // How many days a newly issued quote's prices hold for.
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  quoteValidityDays?: number;

  @IsOptional()
  @IsString()
  documentFooter?: string;

  @IsOptional()
  @IsString()
  paymentDetails?: string;
}