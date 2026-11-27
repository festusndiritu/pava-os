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
  @IsString()
  deliveryNotePrefix?: string;

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

  // Reorder planning: how long a restock normally takes, how many days of sales an order covers,
  // and how sure to be of not running out (percent).
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(60)
  leadTimeDays?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(180)
  coverDays?: number;

  @IsOptional()
  @IsInt()
  @Min(80)
  @Max(99)
  serviceLevel?: number;

  @IsOptional()
  @IsString()
  documentFooter?: string;

  @IsOptional()
  @IsString()
  paymentDetails?: string;
}