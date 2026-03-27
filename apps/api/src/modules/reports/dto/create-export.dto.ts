import { IsString, IsEnum } from 'class-validator';
import { ExportFormat } from '@prisma/client';

export class CreateExportDto {
  @IsString()
  reportRunId!: string;

  @IsEnum(ExportFormat)
  format!: ExportFormat;
}
