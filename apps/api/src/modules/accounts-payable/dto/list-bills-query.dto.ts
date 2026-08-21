import {
  IsString,
  IsOptional,
  IsEnum,
  IsDateString,
  IsBoolean,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MAX_ACCOUNTING_LIST_PAGE_SIZE } from '../../../common/pagination';

export enum BillStatusFilterDto {
  DRAFT = 'DRAFT',
  APPROVED = 'APPROVED',
  PARTIALLY_PAID = 'PARTIALLY_PAID',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
  CANCELLED = 'CANCELLED',
}

export enum BillSourceFilterDto {
  MANUAL_SERVICE = 'MANUAL_SERVICE',
  GRN_LINKED = 'GRN_LINKED',
  EXPENSE = 'EXPENSE',
  RECURRING = 'RECURRING',
  ONE_OFF_EVENT = 'ONE_OFF_EVENT',
  UTILITY = 'UTILITY',
  SUBSCRIPTION = 'SUBSCRIPTION',
}

export class ListBillsQueryDto {
  @IsOptional()
  @IsString()
  supplierId?: string;

  @IsOptional()
  @IsEnum(BillStatusFilterDto)
  status?: BillStatusFilterDto;

  @IsOptional()
  @IsEnum(BillSourceFilterDto)
  sourceType?: BillSourceFilterDto;

  @IsOptional()
  @IsString()
  counterpartyType?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  /** Filter bills with due date on or before this date (for AP aging). */
  @IsOptional()
  @IsDateString()
  overdueAsOf?: string;

  /** Filter bills due within N days from now. */
  @IsOptional()
  @Type(() => Number)
  dueSoonDays?: number;

  /** Only return bills with outstanding amount > 0. */
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  openOnly?: boolean;

  /** Only return bills from recurring profiles. */
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  recurring?: boolean;

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
