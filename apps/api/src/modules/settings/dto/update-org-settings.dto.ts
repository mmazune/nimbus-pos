import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  Min,
  Max,
  Matches,
  IsObject,
  MaxLength,
} from 'class-validator';

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

  /** T6 — minutes before a request for approval climbs to managers (default 3). */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(240)
  approvalClimbMinutes?: number;

  /** T6 — a till over or short by more than this needs a supervisor's sign-off; e.g. "10000". */
  @IsOptional()
  @IsString()
  @Matches(/^\d{1,10}(\.\d{1,2})?$/)
  tillVarianceLimit?: string;

  /** T6 — the hour (0–23, Africa/Kampala) a business day ends (default 5). */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  businessDayEndsHour?: number;

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
