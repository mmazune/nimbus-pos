import { IsOptional, IsBoolean, IsString, IsEnum } from 'class-validator';
import { QuickPinTier } from '@prisma/client';

/**
 * Update quick PIN settings for a user.
 */
export class UpdateQuickPinSettingsDto {
  @IsOptional()
  @IsBoolean()
  quickPinEnabled?: boolean;

  @IsOptional()
  @IsString()
  displayName?: string;

  @IsOptional()
  @IsString()
  employeeCode?: string;

  @IsOptional()
  @IsEnum(QuickPinTier)
  pinTier?: QuickPinTier;

  @IsOptional()
  @IsString()
  avatarUrl?: string;
}
