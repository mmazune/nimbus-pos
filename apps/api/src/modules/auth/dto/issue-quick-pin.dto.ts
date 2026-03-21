import { IsOptional, IsString } from 'class-validator';

/**
 * Issue a new quick PIN to a user.
 * The system generates the PIN, not the caller.
 * branchId is required to derive the lookup hash.
 */
export class IssueQuickPinDto {
  @IsString()
  @IsOptional()
  branchId?: string;
}
