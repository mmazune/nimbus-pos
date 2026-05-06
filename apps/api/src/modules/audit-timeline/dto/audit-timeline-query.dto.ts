import { Type } from 'class-transformer';
import { IsInt, IsISO8601, IsOptional, IsString, Max, Min } from 'class-validator';

export class AuditTimelineQueryDto {
    @IsOptional()
    @IsString()
    entityType?: string;

    @IsOptional()
    @IsString()
    entityId?: string;

    @IsOptional()
    @IsString()
    userId?: string;

    /** Match a single action string exactly (case-insensitive). */
    @IsOptional()
    @IsString()
    action?: string;

    /** Match audit rows whose action begins with this prefix (e.g. "DISCOUNT_"). */
    @IsOptional()
    @IsString()
    actionPrefix?: string;

    @IsOptional()
    @IsISO8601()
    dateFrom?: string;

    @IsOptional()
    @IsISO8601()
    dateTo?: string;

    /** Filter by `metadata.orgId`. Defaults to the caller's branch context. */
    @IsOptional()
    @IsString()
    orgId?: string;

    /** Filter by `metadata.branchId`. */
    @IsOptional()
    @IsString()
    branchId?: string;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(200)
    pageSize?: number;
}
