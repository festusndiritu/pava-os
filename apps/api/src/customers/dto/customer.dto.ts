import { IsBoolean, IsIn, IsOptional, IsString, Length, Min } from 'class-validator';
import { IsMoney } from '../../common/validation/money.validator.js';
import { OptionalKenyanPhone } from '../../common/validation/phone.validator.js';

export class CreateCustomerDto {
  @IsString()
  @Length(1, 160)
  name!: string;

  @IsOptional()
  @IsString()
  businessName?: string;

  @OptionalKenyanPhone()
  phone?: string;

  @OptionalKenyanPhone()
  altPhone?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsBoolean()
  isCredit?: boolean;

  @IsOptional()
  @IsMoney()
  creditLimit?: number;
}

export class UpdateCustomerDto {
  @IsOptional()
  @IsString()
  @Length(1, 160)
  name?: string;

  @IsOptional()
  @IsString()
  businessName?: string;

  @OptionalKenyanPhone()
  phone?: string;

  @OptionalKenyanPhone()
  altPhone?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsBoolean()
  isCredit?: boolean;

  @IsOptional()
  @IsMoney()
  creditLimit?: number;
}

export class RecordPaymentDto {
  @IsMoney()
  @Min(1)
  amount!: number;

  @IsOptional()
  @IsString()
  note?: string;
}

const ADJUST_TYPES = ['ADJUSTMENT', 'OPENING', 'REFUND', 'WRITE_OFF'] as const;

export class AdjustBalanceDto {
  @IsMoney({ allowNegative: true })
  amount!: number; // signed

  @IsIn(ADJUST_TYPES)
  type!: (typeof ADJUST_TYPES)[number];

  @IsOptional()
  @IsString()
  note?: string;
}
