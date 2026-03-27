import { IsEnum, IsOptional, IsString } from 'class-validator';
import { KpiScopeType } from '@prisma/client';

export class DashboardQueryDto {
  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsEnum(KpiScopeType)
  scopeType?: KpiScopeType;
}
