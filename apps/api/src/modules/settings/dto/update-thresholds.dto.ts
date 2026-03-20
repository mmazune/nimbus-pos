import { IsOptional, IsString, IsInt, Min } from 'class-validator';

/**
 * Update anomaly / discount approval thresholds.
 * Shape: { lateVoidMin?: number, heavyDiscountUGX?: number, discountApprovalThreshold?: string }
 */
export class UpdateThresholdsDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  lateVoidMin?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  heavyDiscountUGX?: number;

  /** Decimal-safe string e.g. "5000.00" */
  @IsOptional()
  @IsString()
  discountApprovalThreshold?: string;
}
