import { IsOptional, IsString } from 'class-validator';

/**
 * Reset (rotate) a quick PIN for a user.
 * Old PIN is immediately invalidated.
 * branchId is required to derive the new lookup hash.
 */
export class ResetQuickPinDto {
  @IsString()
  @IsOptional()
  branchId?: string;
}
