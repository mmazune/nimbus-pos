import { IsEnum, IsOptional, IsString } from 'class-validator';

/**
 * BG6 — supported source domains for the unified export facade.
 *
 * Only `reports` currently supports POST-time generation; documents and
 * other artefact-producing domains are listed via GET only (see
 * ListExportsDto).
 */
export enum ExportSourceDomain {
  REPORTS = 'reports',
}

export enum ExportFacadeFormat {
  CSV = 'CSV',
  PDF = 'PDF',
}

/**
 * BG6 — request body for `POST /api/exports`.
 *
 * The facade does not own any export-generation logic. It delegates to
 * the underlying domain service (`ReportsService.createExport(...)`).
 * For `sourceDomain: REPORTS` the caller must supply `reportRunId` plus
 * a target `format` — same contract the legacy
 * `POST /api/reports/export` enforces.
 */
export class CreateExportDto {
  @IsEnum(ExportSourceDomain)
  sourceDomain!: ExportSourceDomain;

  @IsOptional()
  @IsString()
  reportRunId?: string;

  @IsOptional()
  @IsEnum(ExportFacadeFormat)
  format?: ExportFacadeFormat;
}
