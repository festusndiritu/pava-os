import { ArrayMinSize, IsArray, IsIn, IsISO8601, IsOptional, IsString, Min } from 'class-validator';
import { IsMoney } from '../../common/validation/money.validator.js';

export class CreateAdvanceDto {
  @IsString()
  employeeId!: string;

  @IsMoney()
  @Min(1)
  amount!: number;

  @IsOptional()
  @IsISO8601()
  date?: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

const ADVANCE_DECISIONS = ['APPROVED', 'REJECTED'] as const;

export class DecideAdvanceDto {
  @IsIn(ADVANCE_DECISIONS)
  status!: (typeof ADVANCE_DECISIONS)[number];
}

export class CreatePayrollRunDto {
  @IsISO8601()
  periodStart!: string;

  @IsISO8601()
  periodEnd!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  employeeIds!: string[];

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdatePayrollItemDto {
  // Non-negative — a positive amount withheld from pay, not a credit.
  @IsOptional()
  @IsMoney()
  otherDeductions?: number;

  // Signed on purpose: a positive adjustment is a bonus/top-up, a negative
  // one is a manual deduction outside otherDeductions.
  @IsOptional()
  @IsMoney({ allowNegative: true })
  adjustments?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
