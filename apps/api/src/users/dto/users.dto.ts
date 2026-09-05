import { ArrayUnique, IsArray, IsBoolean, IsEnum, IsOptional, IsString, Length, Matches } from 'class-validator';
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
  @IsBoolean()
  active?: boolean;
}

export class ResetPinDto {
  @Matches(/^\d{4}$/, { message: 'PIN must be exactly 4 digits' })
  newPin!: string;
}
