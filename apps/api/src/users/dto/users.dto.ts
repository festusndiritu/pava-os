import { ArrayUnique, IsArray, IsBoolean, IsEnum, IsNumber, IsOptional, IsString, Length, Matches, Max, Min } from 'class-validator';
import { Module } from '../../../generated/prisma/client.js';

export class CreateStaffDto {
  @IsString()
  @Length(1, 80)
  name!: string;

  @Matches(/^\d{4}$/, { message: 'PIN must be exactly 4 digits' })
  pin!: string;

  @IsOptional()
  @IsString()
  avatar?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsArray()
  @ArrayUnique()
  @IsEnum(Module, { each: true })
  permissions!: Module[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  maxDiscountPercent?: number;

  // Separate axis from `permissions` — see schema comment on User.canViewCost.
  @IsOptional()
  @IsBoolean()
  canViewCost?: boolean;

  @IsOptional()
  @IsBoolean()
  canInvoiceWithoutStock?: boolean;
}

export class UpdateStaffDto {
  @IsOptional()
  @IsString()
  @Length(1, 80)
  name?: string;

  @IsOptional()
  @IsString()
  avatar?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsEnum(Module, { each: true })
  permissions?: Module[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  maxDiscountPercent?: number;

  @IsOptional()
  @IsBoolean()
  canViewCost?: boolean;

  @IsOptional()
  @IsBoolean()
  canInvoiceWithoutStock?: boolean;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class ResetPinDto {
  @Matches(/^\d{4}$/, { message: 'PIN must be exactly 4 digits' })
  newPin!: string;
}
