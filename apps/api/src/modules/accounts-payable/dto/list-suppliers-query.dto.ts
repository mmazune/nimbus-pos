import { IsOptional, IsEnum, IsBoolean, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { CounterpartyTypeDto } from './create-supplier.dto';
import { MAX_ACCOUNTING_LIST_PAGE_SIZE } from '../../../common/pagination';

/**
 * B5-F2 (backend gap batch 3): `counterpartyType` was a raw `@Query()`
 * string handed straight to Prisma — same unvalidated-enum-filter class as
 * `ar/invoices` status.
 */
export class ListSuppliersQueryDto {
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  activeOnly?: boolean;

  @IsOptional()
  @IsEnum(CounterpartyTypeDto)
  counterpartyType?: CounterpartyTypeDto;

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
