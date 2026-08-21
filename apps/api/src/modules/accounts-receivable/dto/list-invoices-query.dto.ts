import { IsOptional, IsString, IsEnum, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { InvoiceStatus } from '@prisma/client';
import { MAX_ACCOUNTING_LIST_PAGE_SIZE } from '../../../common/pagination';

/**
 * B5-F2 (backend gap batch 3): `GET /ar/invoices?status=<invalid>` used to
 * take `status` as a raw `@Query()` string and hand it straight to Prisma —
 * an unrecognised value (e.g. `OVERDUE`, which `VendorBillStatus` has but
 * `InvoiceStatus` does not) threw and surfaced as a 500. Validated the same
 * way `ap/bills` already validates `BillStatusFilterDto`.
 */
export class ListInvoicesQueryDto {
  @IsOptional()
  @IsString()
  customerAccountId?: string;

  @IsOptional()
  @IsEnum(InvoiceStatus)
  status?: InvoiceStatus;

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
