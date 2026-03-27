import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsInt,
  IsObject,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateAnomalyRuleDto {
  @IsString()
  @MaxLength(50)
  code!: string;

  @IsString()
  @MaxLength(200)
  name!: string;

  @IsEnum(['VOID_SPIKE', 'DISCOUNT_ABUSE', 'CASH_VARIANCE', 'SHRINKAGE', 'LATE_CLOSE', 'PRICE_OVERRIDE', 'REFUND_SPIKE', 'NO_SHOW_PATTERN', 'CHECKIN_DENIED_PATTERN', 'CUSTOM'])
  type!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsEnum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
  severity!: string;

  @IsString()
  @MaxLength(100)
  metricKey!: string;

  @IsString()
  @MaxLength(10)
  operator!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  thresholdValue?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  windowMinutes?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  minimumSampleSize?: number;

  @IsOptional()
  @IsEnum(['STAFF', 'BRANCH', 'ORDER', 'SHIFT', 'TILL', 'INVENTORY_ITEM', 'EVENT', 'RESERVATION'])
  appliesToEntityType?: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, any>;
}
