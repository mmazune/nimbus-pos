import { IsEnum, IsOptional, IsDateString, IsObject } from 'class-validator';
import { ReportWindow } from '@prisma/client';

export class CreatePaymentMixReportDto {
  @IsEnum(ReportWindow)
  reportWindow!: ReportWindow;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @IsObject()
  parameters?: Record<string, any>;
}
