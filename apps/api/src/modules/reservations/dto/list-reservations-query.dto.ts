import { IsOptional, IsString, IsEnum, IsInt, IsDateString, IsBoolean, Min } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Prompt 4A — bounded, server-side reservation list query.
 *
 * `scope` groups terminal vs. active statuses server-side (active/history) so
 * the operational queue and the history list are separated at the query layer
 * — the browser never merges overlapping all/today/upcoming responses.
 *
 * Numeric coercion uses the same `@Type(() => Number)` pattern that fixed the
 * Prompt 3 discount-list query. `pageSize` is additionally clamped to a safe
 * maximum in the service (see DEFAULT_PAGE_SIZE / MAX_PAGE_SIZE) rather than
 * hard-rejected, so a legacy caller requesting a large page is bounded, not 400'd.
 *
 * Timezone note: `date` / `from` / `to` boundaries are applied server-side.
 * Branch timezone is not yet modelled, so day edges use UTC (documented
 * limitation) — dates are never compared only in the browser.
 */
export class ListReservationsQueryDto {
  @IsOptional()
  @IsEnum(['PENDING', 'CONFIRMED', 'SEATED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'])
  status?: string;

  @IsOptional()
  @IsEnum(['active', 'history'])
  scope?: 'active' | 'history';

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  upcoming?: boolean;

  @IsOptional()
  @IsString()
  tableId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number;
}
