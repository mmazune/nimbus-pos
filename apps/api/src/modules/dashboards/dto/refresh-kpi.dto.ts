import { IsEnum, IsOptional, IsString } from 'class-validator';
import { KpiScopeType, KpiMetricWindow } from '@prisma/client';

export class RefreshKpiDto {
  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsEnum(KpiScopeType)
  scopeType?: KpiScopeType;

  @IsOptional()
  @IsEnum(KpiMetricWindow)
  metricWindow?: KpiMetricWindow;
}
