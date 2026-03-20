import { IsString, IsOptional, IsBoolean, IsInt, Min, IsObject, MaxLength } from 'class-validator';

/**
 * Partial update for the org settings record.
 * All fields optional — only supplied fields are merged.
 */
export class UpdateOrgSettingsDto {
  /** e.g. "18.00" — Decimal-safe string accepted */
  @IsOptional()
  @IsString()
  vatPercent?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  currency?: string;

  /** e.g. "5000.00" — Decimal-safe string */
  @IsOptional()
  @IsString()
  discountApprovalThreshold?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  reservationHoldMinutes?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  receiptFooter?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  anomalyThresholds?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  platformAccess?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  franchiseWeights?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  showCostToChef?: boolean;

  @IsOptional()
  @IsObject()
  defaults?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  baseCurrencyCode?: string;

  @IsOptional()
  @IsObject()
  taxMatrix?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  rounding?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  bookingPolicies?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  attendance?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  inventoryTolerance?: Record<string, unknown>;
}
