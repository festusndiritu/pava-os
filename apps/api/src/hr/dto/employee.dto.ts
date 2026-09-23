import { IsIn, IsOptional, IsString, Length } from 'class-validator';
import { IsMoney } from '../../common/validation/money.validator.js';
import { OptionalKenyanPhone } from '../../common/validation/phone.validator.js';

const EMPLOYMENT_STATUSES = ['ACTIVE', 'ON_LEAVE', 'TERMINATED'] as const;

export class CreateEmployeeDto {
  @IsString()
  @Length(1, 160)
  displayName!: string;

  @IsOptional()
  @IsString()
  avatar?: string;

  @OptionalKenyanPhone()
  phone?: string;

  @IsOptional()
  @IsString()
  emergencyContactName?: string;

  @OptionalKenyanPhone()
  emergencyContactPhone?: string;

  @IsOptional()
  @IsString()
  jobTitle?: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsString()
  employmentStartDate?: string;

  @IsOptional()
  @IsIn(EMPLOYMENT_STATUSES)
  employmentStatus?: (typeof EMPLOYMENT_STATUSES)[number];

  @IsOptional()
  @IsMoney()
  baseSalary?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateEmployeeDto {
  @IsOptional()
  @IsString()
  @Length(1, 160)
  displayName?: string;

  @IsOptional()
  @IsString()
  avatar?: string;

  @OptionalKenyanPhone()
  phone?: string;

  @IsOptional()
  @IsString()
  emergencyContactName?: string;

  @OptionalKenyanPhone()
  emergencyContactPhone?: string;

  @IsOptional()
  @IsString()
  jobTitle?: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsString()
  employmentStartDate?: string;

  @IsOptional()
  @IsIn(EMPLOYMENT_STATUSES)
  employmentStatus?: (typeof EMPLOYMENT_STATUSES)[number];

  @IsOptional()
  @IsMoney()
  baseSalary?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
