import { IsNotEmpty, IsString, Matches, IsEnum } from 'class-validator';
import { SessionPlatform } from '@prisma/client';

/**
 * Quick PIN login DTO.
 * PIN format: exactly 6 or 8 numeric digits.
 * Platform must be POS_DESKTOP.
 */
export class QuickPinLoginDto {
  @IsString()
  @IsNotEmpty()
  branchId!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{6}(\d{2})?$/, {
    message: 'PIN must be exactly 6 or 8 numeric digits',
  })
  pin!: string;

  @IsEnum(SessionPlatform)
  @IsNotEmpty()
  platform!: SessionPlatform;
}
