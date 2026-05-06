import {
    IsString,
    IsOptional,
    IsNotEmpty,
    IsEnum,
    IsArray,
    IsInt,
    Min,
    Max,
    IsObject,
    IsDateString,
    MaxLength,
    ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

// ── Const arrays mirror schema enums (string unions kept loose so
//    unit tests don't need the Prisma client) ──
export const SYNC_JOB_TYPES = [
    'ORDER_DRAFT_UPDATE',
    'ORDER_SUBMIT',
    'PAYMENT_CAPTURE',
    'REFUND_CREATE',
    'AR_RECEIPT_CREATE',
    'AP_PAYMENT_CREATE',
    'RESERVATION_HOLD',
    'RESERVATION_CONFIRM',
    'EVENT_BOOKING_HOLD',
    'EVENT_BOOKING_CONFIRM',
    'STOCK_ADJUSTMENT',
    'ATTENDANCE_EVENT',
    'SHIFT_ACTION',
    'GENERIC_REPLAY',
] as const;
export type SyncJobTypeT = (typeof SYNC_JOB_TYPES)[number];

export const SYNC_JOB_STATUSES = [
    'QUEUED',
    'IN_PROGRESS',
    'SUCCEEDED',
    'FAILED',
    'RETRYABLE',
    'CONFLICT',
    'CANCELLED',
] as const;

export const SYNC_JOB_ORIGINS = [
    'OFFLINE_CLIENT',
    'SERVICE_WORKER',
    'SUPPORT_REPLAY',
    'SYSTEM_RETRY',
] as const;

export const SYNC_CONFLICT_RESOLUTIONS = [
    'SERVER_TRUTH_KEPT',
    'CLIENT_PAYLOAD_APPLIED',
    'MANUAL_MERGE',
    'DISCARDED',
] as const;

export const SYNC_CONFLICT_STATUSES = ['OPEN', 'RESOLVED', 'DISMISSED'] as const;

// ── Replayable job DTO ──

export class ReplayJobItemDto {
    @IsString() @IsNotEmpty() @MaxLength(120) clientMutationId!: string;
    @IsEnum(SYNC_JOB_TYPES) type!: SyncJobTypeT;
    @IsString() @IsOptional() @MaxLength(120) idempotencyKey?: string;
    @IsString() @IsOptional() @MaxLength(80) routeMethod?: string;
    @IsString() @IsOptional() @MaxLength(240) routePath?: string;
    @IsObject() requestBody!: Record<string, unknown>;
    @IsObject() @IsOptional() requestHeaders?: Record<string, unknown>;
    @IsString() @IsOptional() @MaxLength(240) intentSummary?: string;
    @IsDateString() capturedAt!: string;
    @IsString() @IsOptional() @MaxLength(40) branchId?: string;
    @IsEnum(SYNC_JOB_ORIGINS) @IsOptional() origin?: (typeof SYNC_JOB_ORIGINS)[number];
    @IsObject() @IsOptional() metadata?: Record<string, unknown>;
}

export class ReplayBatchDto {
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ReplayJobItemDto)
    jobs!: ReplayJobItemDto[];
    /**
     * If true, replay each job synchronously now. If false, the jobs are
     * queued and the response returns immediately. Default: true.
     */
    @IsOptional() executeNow?: boolean;
}

// ── Listing query DTOs ──

export class ListSyncJobsQueryDto {
    @IsString() @IsOptional() status?: string;
    @IsString() @IsOptional() type?: string;
    @IsString() @IsOptional() branchId?: string;
    @IsString() @IsOptional() origin?: string;
    @IsInt() @Min(1) @Max(200) @IsOptional() @Type(() => Number) limit?: number;
    @IsString() @IsOptional() since?: string;
}

export class ListConflictsQueryDto {
    @IsString() @IsOptional() status?: string;
    @IsString() @IsOptional() type?: string;
    @IsInt() @Min(1) @Max(200) @IsOptional() @Type(() => Number) limit?: number;
}

// ── Conflict resolution DTO ──

export class ResolveConflictDto {
    @IsEnum(SYNC_CONFLICT_RESOLUTIONS) resolution!: (typeof SYNC_CONFLICT_RESOLUTIONS)[number];
    @IsString() @IsOptional() @MaxLength(500) note?: string;
}

// ── Idempotency inspect (debug only) ──

export class IdempotencyInspectDto {
    @IsString() @IsNotEmpty() @MaxLength(120) key!: string;
    @IsString() @IsNotEmpty() @MaxLength(80) routeMethod!: string;
    @IsString() @IsNotEmpty() @MaxLength(240) routePath!: string;
    @IsString() @IsOptional() scope?: string;
}
