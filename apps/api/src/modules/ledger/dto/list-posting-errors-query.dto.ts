import { IsOptional, IsEnum, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { PostingErrorStatus } from '@prisma/client';
import { MAX_ACCOUNTING_LIST_PAGE_SIZE } from '../../../common/pagination';

/**
 * B5-F2 (backend gap batch 3): `status` was a raw `@Query()` string handed
 * straight to Prisma — same unvalidated-enum-filter class as `ar/invoices`.
 */
export class ListPostingErrorsQueryDto {
  @IsOptional()
  @IsEnum(PostingErrorStatus)
  status?: PostingErrorStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip?: number;

  /** B5-F3 (backend gap batch 3): previously unbounded. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_ACCOUNTING_LIST_PAGE_SIZE)
  take?: number;
}
