import { Type } from 'class-transformer';
import { IsString, Matches, MaxLength, ValidateNested } from 'class-validator';

class PushKeysDto {
  @IsString()
  @MaxLength(256)
  p256dh!: string;

  @IsString()
  @MaxLength(256)
  auth!: string;
}

export class SubscribeDto {
  @IsString()
  @MaxLength(2048)
  @Matches(/^https:\/\//, { message: 'endpoint must be an https URL' })
  endpoint!: string;

  @ValidateNested()
  @Type(() => PushKeysDto)
  keys!: PushKeysDto;
}

export class UnsubscribeDto {
  @IsString()
  @MaxLength(2048)
  endpoint!: string;
}
