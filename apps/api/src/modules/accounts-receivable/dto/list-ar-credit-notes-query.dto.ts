import { IsOptional, IsString, IsEnum, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ArCreditNoteStatus } from '@prisma/client';
import { MAX_ACCOUNTING_LIST_PAGE_SIZE } from '../../../common/pagination';

/**
 * B5-F2 (backend gap batch 3): sibling of `ar/invoices` — `status` was a raw
 * `@Query()` string handed to Prisma with no validation.
 */
export class ListArCreditNotesQueryDto {
  @IsOptional()
  @IsString()
  customerAccountId?: string;

  @IsOptional()
  @IsEnum(ArCreditNoteStatus)
  status?: ArCreditNoteStatus;

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
