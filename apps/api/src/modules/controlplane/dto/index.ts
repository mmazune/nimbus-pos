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
    ArrayUnique,
} from 'class-validator';
import { Type } from 'class-transformer';

// ── String unions mirror schema enums (kept loose so tests don't need
//    the Prisma client) ──
export const FEATURE_FLAG_SCOPES = ['GLOBAL', 'ORG', 'BRANCH'] as const;
export type FeatureFlagScopeT = (typeof FEATURE_FLAG_SCOPES)[number];

export const FEATURE_FLAG_STATUSES = ['ENABLED', 'DISABLED', 'ARCHIVED'] as const;
export type FeatureFlagStatusT = (typeof FEATURE_FLAG_STATUSES)[number];

export const MAINTENANCE_WINDOW_STATUSES = [
    'SCHEDULED',
    'ACTIVE',
    'COMPLETED',
    'CANCELLED',
] as const;
export type MaintenanceWindowStatusT = (typeof MAINTENANCE_WINDOW_STATUSES)[number];

export const MAINTENANCE_WINDOW_MODES = ['ANNOUNCEMENT_ONLY', 'BLOCK_WRITES'] as const;
export type MaintenanceWindowModeT = (typeof MAINTENANCE_WINDOW_MODES)[number];

export const WRITE_BLOCK_CATEGORIES = [
    'BILLING_WRITES',
    'INVENTORY_WRITES',
    'ACCOUNTING_WRITES',
    'PUBLIC_BOOKING_WRITES',
    'ADMIN_CONFIGURATION_WRITES',
    'ALL_WRITES',
] as const;
export type WriteBlockCategoryT = (typeof WRITE_BLOCK_CATEGORIES)[number];

export const TRAINING_SESSION_MODES = ['SANDBOX_ISOLATED', 'SIMULATION_ONLY'] as const;
export type TrainingSessionModeT = (typeof TRAINING_SESSION_MODES)[number];

export const TRAINING_SESSION_STATUSES = [
    'ACTIVE',
    'COMPLETED',
    'EXPIRED',
    'CANCELLED',
] as const;
export type TrainingSessionStatusT = (typeof TRAINING_SESSION_STATUSES)[number];

// ── Feature Flag DTOs ──

export class CreateFeatureFlagDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(120)
    key!: string;

    @IsString()
    @IsNotEmpty()
    @MaxLength(160)
    name!: string;

    @IsOptional()
    @IsString()
    @MaxLength(500)
    description?: string;

    @IsOptional()
    @IsEnum(FEATURE_FLAG_SCOPES)
    scope?: FeatureFlagScopeT;

    @IsOptional()
    @IsString()
    branchId?: string;

    @IsOptional()
    @IsEnum(FEATURE_FLAG_STATUSES)
    status?: FeatureFlagStatusT;

    @IsOptional()
    @IsInt()
    @Min(0)
    @Max(100)
    rolloutPercent?: number;

    @IsOptional()
    @IsObject()
    targeting?: Record<string, unknown>;

    @IsOptional()
    @IsObject()
    metadata?: Record<string, unknown>;
}

export class UpdateFeatureFlagDto {
    @IsOptional()
    @IsString()
    @MaxLength(160)
    name?: string;

    @IsOptional()
    @IsString()
    @MaxLength(500)
    description?: string;

    @IsOptional()
    @IsEnum(FEATURE_FLAG_STATUSES)
    status?: FeatureFlagStatusT;

    @IsOptional()
    @IsInt()
    @Min(0)
    @Max(100)
    rolloutPercent?: number;

    @IsOptional()
    @IsObject()
    targeting?: Record<string, unknown>;

    @IsOptional()
    @IsObject()
    metadata?: Record<string, unknown>;

    @IsOptional()
    @IsString()
    @MaxLength(500)
    note?: string;
}

export class ListFeatureFlagsQueryDto {
    @IsOptional()
    @IsEnum(FEATURE_FLAG_STATUSES)
    status?: FeatureFlagStatusT;

    @IsOptional()
    @IsEnum(FEATURE_FLAG_SCOPES)
    scope?: FeatureFlagScopeT;

    @IsOptional()
    @IsString()
    branchId?: string;
}

// ── Maintenance Window DTOs ──

export class CreateMaintenanceWindowDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(120)
    code!: string;

    @IsString()
    @IsNotEmpty()
    @MaxLength(160)
    title!: string;

    @IsOptional()
    @IsString()
    @MaxLength(500)
    message?: string;

    @IsOptional()
    @IsEnum(MAINTENANCE_WINDOW_MODES)
    mode?: MaintenanceWindowModeT;

    @IsOptional()
    @IsString()
    branchId?: string;

    @IsOptional()
    @IsArray()
    @ArrayUnique()
    @IsEnum(WRITE_BLOCK_CATEGORIES, { each: true })
    blockCategories?: WriteBlockCategoryT[];

    @IsDateString()
    startsAt!: string;

    @IsDateString()
    endsAt!: string;

    @IsOptional()
    @IsObject()
    metadata?: Record<string, unknown>;
}

export class UpdateMaintenanceWindowDto {
    @IsOptional()
    @IsString()
    @MaxLength(160)
    title?: string;

    @IsOptional()
    @IsString()
    @MaxLength(500)
    message?: string;

    @IsOptional()
    @IsEnum(MAINTENANCE_WINDOW_MODES)
    mode?: MaintenanceWindowModeT;

    @IsOptional()
    @IsEnum(MAINTENANCE_WINDOW_STATUSES)
    status?: MaintenanceWindowStatusT;

    @IsOptional()
    @IsArray()
    @ArrayUnique()
    @IsEnum(WRITE_BLOCK_CATEGORIES, { each: true })
    blockCategories?: WriteBlockCategoryT[];

    @IsOptional()
    @IsDateString()
    startsAt?: string;

    @IsOptional()
    @IsDateString()
    endsAt?: string;

    @IsOptional()
    @IsObject()
    metadata?: Record<string, unknown>;

    @IsOptional()
    @IsString()
    @MaxLength(500)
    note?: string;
}

export class ListMaintenanceWindowsQueryDto {
    @IsOptional()
    @IsEnum(MAINTENANCE_WINDOW_STATUSES)
    status?: MaintenanceWindowStatusT;

    @IsOptional()
    @IsString()
    branchId?: string;
}

// ── Training Session DTOs ──

export class StartTrainingSessionDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(160)
    label!: string;

    @IsOptional()
    @IsString()
    @MaxLength(500)
    purpose?: string;

    @IsOptional()
    @IsEnum(TRAINING_SESSION_MODES)
    mode?: TrainingSessionModeT;

    @IsOptional()
    @IsString()
    branchId?: string;

    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(8 * 60)
    durationMinutes?: number;

    @IsOptional()
    @IsObject()
    metadata?: Record<string, unknown>;
}

export class EndTrainingSessionDto {
    @IsOptional()
    @IsString()
    @MaxLength(500)
    note?: string;
}

export class ListTrainingSessionsQueryDto {
    @IsOptional()
    @IsEnum(TRAINING_SESSION_STATUSES)
    status?: TrainingSessionStatusT;

    @IsOptional()
    @IsString()
    actorUserId?: string;
}

// ── Flag audit query ──

export class ListFlagAuditsQueryDto {
    @IsOptional()
    @IsString()
    flagId?: string;

    @IsOptional()
    @IsString()
    maintenanceWindowId?: string;

    @IsOptional()
    @IsString()
    action?: string;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(500)
    limit?: number;
}
