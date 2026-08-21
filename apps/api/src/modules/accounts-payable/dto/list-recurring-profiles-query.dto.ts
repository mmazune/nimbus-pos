import { IsString, IsOptional, IsEnum, IsBoolean, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { RecurrenceCadenceDto } from './create-recurring-profile.dto';
import { MAX_ACCOUNTING_LIST_PAGE_SIZE } from '../../../common/pagination';

export class ListRecurringProfilesQueryDto {
  @IsOptional()
  @IsString()
  supplierId?: string;

  @IsOptional()
  @IsEnum(RecurrenceCadenceDto)
  cadence?: RecurrenceCadenceDto;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isActive?: boolean;

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
