import { IsOptional, IsString, IsDateString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { MAX_ACCOUNTING_LIST_PAGE_SIZE } from '../../../common/pagination';

export class AgingQueryDto {
  /** Compute aging as of this date (ISO date). Defaults to today. */
  @IsOptional()
  @IsDateString()
  asOf?: string;

  @IsOptional()
  @IsString()
  customerAccountId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip?: number;

  /**
   * Bounds the PAGE fed into the `accounts` display breakdown only — B5-F1
   * (backend gap batch 3) made `summary.*` independent of this value by
   * computing the grand totals from a separate unpaginated query. B5-F3
   * (backend gap batch 3): previously unbounded — `take` alone accepted any
   * value.
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_ACCOUNTING_LIST_PAGE_SIZE)
  take?: number;
}
