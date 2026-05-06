import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * BG4.B — Merge two open orders.
 *
 * Source order's items are moved onto the target. Source becomes
 * VOIDED with `mergedIntoOrderId = target.id`. Existing KDS tickets
 * for the source remain in place; their metadata is updated to record
 * `mergedInto: target.id` so kitchen staff can correlate.
 */
export class MergeOrdersDto {
    @IsString()
    sourceOrderId!: string;

    @IsString()
    targetOrderId!: string;

    @IsOptional()
    @IsString()
    @MaxLength(200)
    reason?: string;
}
