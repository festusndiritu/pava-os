import { IsNumber, IsOptional, IsPositive, Max } from 'class-validator';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { RequiredName } from '../../common/validation/trimmed.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateUnitDto {
  @RequiredName()
  name!: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Symbol is required' })
  @MaxLength(12, { message: 'Symbol can be at most 12 characters' })
  symbol!: string;
}

export class UpdateUnitDto {
  @IsOptional()
  @RequiredName()
  name?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Symbol is required' })
  @MaxLength(12, { message: 'Symbol can be at most 12 characters' })
  symbol?: string;
}

export class CreateSubUnitDto {
  @RequiredName()
  name!: string;

  @IsNumber({}, { message: 'Factor must be a number' })
  @IsPositive({ message: 'Factor must be greater than zero' })
  @Max(1_000_000)
  factor!: number;
}

export class UpdateSubUnitDto {
  @IsOptional()
  @RequiredName()
  name?: string;

  @IsOptional()
  @IsNumber({}, { message: 'Factor must be a number' })
  @IsPositive({ message: 'Factor must be greater than zero' })
  @Max(1_000_000)
  factor?: number;
}
