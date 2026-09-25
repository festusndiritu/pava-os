import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** A required, trimmed, non-empty display name ("Brand", "Kilogram", ...). */
export function RequiredName(max = 60) {
  return applyDecorators(
    Transform(({ value }) => (typeof value === 'string' ? value.trim() : value)),
    IsString(),
    IsNotEmpty({ message: 'Name is required' }),
    MaxLength(max, { message: `Name can be at most ${max} characters` }),
  );
}
