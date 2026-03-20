import { IsEmail, IsNotEmpty, IsString, Matches, IsOptional, IsEnum } from 'class-validator';
import { SessionPlatform } from '@prisma/client';

/**
 * PIN login DTO.
 * PIN format: 4–6 digits only.
 */
export class PinLoginDto {
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4,6}$/, {
    message: 'PIN must be 4–6 digits',
  })
  pin!: string;

  @IsOptional()
  @IsEnum(SessionPlatform)
  platform?: SessionPlatform;
}
