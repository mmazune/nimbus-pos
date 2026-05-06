import { IsOptional, IsString, IsDateString } from 'class-validator';

export class UpdateActualsDto {
  /**
   * Optional override for the start of the actuals pull window.
   * Defaults to the budget's periodStart.
   */
  @IsOptional()
  @IsDateString()
  windowStart?: string;

  /**
   * Optional override for the end of the actuals pull window.
   * Defaults to the budget's periodEnd or now, whichever is earlier.
   */
  @IsOptional()
  @IsDateString()
  windowEnd?: string;

  /** Optional note recorded in the audit event. */
  @IsOptional()
  @IsString()
  notes?: string;
}
