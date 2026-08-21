import { IsOptional, IsEnum } from 'class-validator';
import { ProcurementSuggestionStatus, ProcurementUrgency } from '@prisma/client';

/**
 * B5-F2 (backend gap batch 3): `urgency`/`status` were raw `@Query()`
 * strings handed straight to Prisma — same unvalidated-enum-filter class as
 * `ar/invoices`. `finance/procurement-suggestions` is unpaginated by design
 * (PC-06 bare array) so no `take` bound applies here.
 */
export class ListProcurementSuggestionsQueryDto {
  @IsOptional()
  @IsEnum(ProcurementUrgency)
  urgency?: ProcurementUrgency;

  @IsOptional()
  @IsEnum(ProcurementSuggestionStatus)
  status?: ProcurementSuggestionStatus;
}
