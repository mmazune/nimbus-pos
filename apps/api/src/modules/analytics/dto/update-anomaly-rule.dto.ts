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

export class UpdateAnomalyRuleDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsEnum(['ACTIVE', 'INACTIVE'])
  status?: string;

  @IsOptional()
  @IsEnum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
  severity?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  metricKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  operator?: string;

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
