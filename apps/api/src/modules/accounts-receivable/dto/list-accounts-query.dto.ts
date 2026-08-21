import { IsOptional, IsString, IsEnum, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { MAX_ACCOUNTING_LIST_PAGE_SIZE } from '../../../common/pagination';

export enum AccountStatusFilterEnum {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
}

export enum AccountTypeFilterEnum {
  CORPORATE = 'CORPORATE',
  HOUSE = 'HOUSE',
  INDIVIDUAL = 'INDIVIDUAL',
}

export class ListAccountsQueryDto {
  @IsOptional()
  @IsEnum(AccountStatusFilterEnum)
  status?: AccountStatusFilterEnum;

  @IsOptional()
  @IsEnum(AccountTypeFilterEnum)
  type?: AccountTypeFilterEnum;

  @IsOptional()
  @IsString()
  branchId?: string;

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
