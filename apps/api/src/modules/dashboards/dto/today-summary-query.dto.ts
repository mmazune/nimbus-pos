import { IsEnum, IsOptional, IsString } from 'class-validator';
import { KpiMetricWindow } from '@prisma/client';

export class TodaySummaryQueryDto {
    @IsOptional()
    @IsString()
    branchId?: string;

    @IsOptional()
    @IsEnum(KpiMetricWindow)
    window?: KpiMetricWindow;
}
