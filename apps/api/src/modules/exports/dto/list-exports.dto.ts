import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ExportFacadeFormat, ExportSourceDomain } from './create-export.dto';

export enum ExportFacadeStatus {
  QUEUED = 'QUEUED',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  EXPIRED = 'EXPIRED',
}

/**
 * BG6 — query parameters for `GET /api/exports`.
 *
 * The facade unions across (a) report export artefacts and (b) document
 * uploads (which are persistent downloadable artefacts — the existing
 * "download center" surface). Filters are best-effort across both
 * stores; unknown fields are silently ignored per source domain.
 */
export class ListExportsDto {
  @IsOptional()
  @IsEnum(ExportSourceDomain, {
    message:
      'sourceDomain must be one of: reports — additional domains will be added via this filter',
  })
  sourceDomain?: ExportSourceDomain;

  /**
   * Loose `sourceType` filter — for the reports domain this is the
   * underlying ReportType (DAILY_SALES, SHIFT_END, etc.). Unknown values
   * simply yield zero rows for that domain.
   */
  @IsOptional()
  @IsString()
  sourceType?: string;

  @IsOptional()
  @IsEnum(ExportFacadeStatus)
  status?: ExportFacadeStatus;

  @IsOptional()
  @IsEnum(ExportFacadeFormat)
  format?: ExportFacadeFormat;

  @IsOptional()
  @IsString()
  requestedBy?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}
