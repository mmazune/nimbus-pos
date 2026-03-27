import { IsOptional, IsEnum, IsString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class ListAnomaliesQueryDto {
  @IsOptional()
  @IsEnum(['OPEN', 'ACKNOWLEDGED', 'RESOLVED'])
  status?: string;

  @IsOptional()
  @IsEnum([
    'VOID_SPIKE',
    'DISCOUNT_ABUSE',
    'CASH_VARIANCE',
    'SHRINKAGE',
    'LATE_CLOSE',
    'PRICE_OVERRIDE',
    'REFUND_SPIKE',
    'NO_SHOW_PATTERN',
    'CHECKIN_DENIED_PATTERN',
    'CUSTOM',
  ])
  type?: string;

  @IsOptional()
  @IsEnum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
  severity?: string;

  @IsOptional()
  @IsString()
  actorUserId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}
