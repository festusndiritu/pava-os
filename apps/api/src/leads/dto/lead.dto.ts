import { IsIn, IsNumber, IsOptional, IsString, Length, Min } from 'class-validator';

const STAGES = ['NEW', 'CONTACTED', 'QUALIFIED', 'QUOTE_REQUIRED', 'QUOTE_SENT', 'NEGOTIATING', 'WON', 'LOST'] as const;

export class CreateLeadDto {
  @IsString()
  @Length(1, 160)
  name!: string;

  @IsOptional()
  @IsString()
  company?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsIn(STAGES)
  stage?: (typeof STAGES)[number];

  @IsOptional()
  @IsNumber()
  @Min(0)
  expectedValue?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  followUpAt?: string;

  @IsOptional()
  @IsString()
  assignedToId?: string;
}

export class UpdateLeadDto {
  @IsOptional()
  @IsString()
  @Length(1, 160)
  name?: string;

  @IsOptional()
  @IsString()
  company?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsIn(STAGES)
  stage?: (typeof STAGES)[number];

  @IsOptional()
  @IsNumber()
  @Min(0)
  expectedValue?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  followUpAt?: string;

  @IsOptional()
  @IsString()
  assignedToId?: string;
}