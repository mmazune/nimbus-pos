import { IsOptional, IsString, IsEnum, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { MAX_ACCOUNTING_LIST_PAGE_SIZE } from '../../../common/pagination';

enum JournalStatusFilter {
  DRAFT = 'DRAFT',
  POSTED = 'POSTED',
  REVERSED = 'REVERSED',
}

export class ListJournalsQueryDto {
  @IsOptional()
  @IsEnum(JournalStatusFilter)
  status?: JournalStatusFilter;

  @IsOptional()
  @IsString()
  sourceKey?: string;

  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;

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
