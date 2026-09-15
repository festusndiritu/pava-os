import { ArrayMinSize, IsArray, IsIn, IsISO8601, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateAdvanceDto {
  @IsString()
  employeeId!: string;

  @IsNumber()
  @Min(0.01)
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
  @IsOptional()
  @IsNumber()
  otherDeductions?: number;

  @IsOptional()
  @IsNumber()
  adjustments?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}