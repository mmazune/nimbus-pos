import { IsEnum, IsOptional, IsDateString, IsObject, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ReportWindow } from '@prisma/client';

export class CreateTopItemsReportDto {
  @IsEnum(ReportWindow)
  reportWindow!: ReportWindow;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @IsOptional()
  @IsObject()
  parameters?: Record<string, any>;
}
