import { IsEmail, IsOptional, IsString, Length, Matches, MinLength } from 'class-validator';

export class LoginPasswordDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  password!: string;
}

export class LoginPinDto {
  @IsString()
  userId!: string;

  @Matches(/^\d{4}$/, { message: 'PIN must be exactly 4 digits' })
  pin!: string;
}

export class RefreshDto {
  @IsString()
  refreshToken!: string;
}

export class ChangePinDto {
  @Matches(/^\d{4}$/, { message: 'PIN must be exactly 4 digits' })
  currentPin!: string;

  @Matches(/^\d{4}$/, { message: 'PIN must be exactly 4 digits' })
  newPin!: string;
}

export class ChangePasswordDto {
  @IsString()
  @MinLength(1)
  currentPassword!: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  newPassword!: string;
}

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @Length(1, 80)
  name?: string;

  @IsOptional()
  @IsString()
  avatar?: string;
}
