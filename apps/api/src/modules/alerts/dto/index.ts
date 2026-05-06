import {
    IsString,
    IsOptional,
    IsNotEmpty,
    IsEnum,
    IsArray,
    IsInt,
    Min,
    Max,
    IsBoolean,
    IsObject,
    ArrayMinSize,
    MaxLength,
} from 'class-validator';

// ── M40 enums (string unions kept loose so tests don't need Prisma client) ──

export const ALERT_RULE_TYPES = [
    'LOW_STOCK',
    'CASH_VARIANCE',
    'BOOKING_REMINDER',
    'BILLING_PAYMENT_FAILURE',
    'OVERDUE_VENDOR_BILL',
    'UPCOMING_EVENT_STOCK_RISK',
    'SHIFT_NOT_CLOSED',
    'LARGE_WASTAGE_SPIKE',
    'FAILED_WEBHOOK_DELIVERY',
    'FRANCHISE_BRANCH_AT_RISK',
] as const;

export const ALERT_CATEGORIES = [
    'OPERATIONAL_IMMEDIATE',
    'OWNER_FINANCE',
    'BOOKING_EVENT',
    'TECHNICAL_INTEGRATION',
] as const;

export const ALERT_CHANNEL_INTENTS = [
    'MOBILE_SMS',
    'EMAIL_DIGEST',
    'SLACK_WEBHOOK',
    'ALL_CHANNELS',
] as const;

export const ALERT_SEVERITIES = ['INFO', 'WARNING', 'CRITICAL'] as const;
export const ALERT_RULE_STATUSES = ['ACTIVE', 'DISABLED'] as const;
export const ALERT_CHANNEL_TYPES = ['EMAIL', 'SMS', 'SLACK'] as const;
export const ALERT_CHANNEL_STATUSES = ['ACTIVE', 'DISABLED'] as const;
export const DIGEST_FREQUENCIES = ['DAILY', 'WEEKLY'] as const;
export const DIGEST_SCHEDULE_STATUSES = ['ACTIVE', 'DISABLED'] as const;

// ── Alert Rule DTOs ──

export class CreateAlertRuleDto {
    @IsString() @IsNotEmpty() @MaxLength(80) code!: string;
    @IsString() @IsNotEmpty() @MaxLength(120) name!: string;
    @IsString() @IsOptional() @MaxLength(500) description?: string;
    @IsEnum(ALERT_RULE_TYPES) type!: (typeof ALERT_RULE_TYPES)[number];
    @IsEnum(ALERT_SEVERITIES) @IsOptional() severity?: (typeof ALERT_SEVERITIES)[number];
    @IsEnum(ALERT_RULE_STATUSES) @IsOptional() status?: (typeof ALERT_RULE_STATUSES)[number];
    @IsEnum(ALERT_CATEGORIES) @IsOptional() alertCategory?: (typeof ALERT_CATEGORIES)[number];
    @IsEnum(ALERT_CHANNEL_INTENTS) @IsOptional() channelIntent?: (typeof ALERT_CHANNEL_INTENTS)[number];
    @IsString() @IsOptional() branchId?: string;
    @IsObject() @IsOptional() thresholdConfig?: Record<string, unknown>;
    @IsArray() @IsString({ each: true }) @IsOptional() channelCodes?: string[];
    @IsObject() @IsOptional() escalationConfig?: Record<string, unknown>;
}

export class UpdateAlertRuleDto {
    @IsString() @IsOptional() @MaxLength(120) name?: string;
    @IsString() @IsOptional() @MaxLength(500) description?: string;
    @IsEnum(ALERT_SEVERITIES) @IsOptional() severity?: (typeof ALERT_SEVERITIES)[number];
    @IsEnum(ALERT_RULE_STATUSES) @IsOptional() status?: (typeof ALERT_RULE_STATUSES)[number];
    @IsEnum(ALERT_CATEGORIES) @IsOptional() alertCategory?: (typeof ALERT_CATEGORIES)[number];
    @IsEnum(ALERT_CHANNEL_INTENTS) @IsOptional() channelIntent?: (typeof ALERT_CHANNEL_INTENTS)[number];
    @IsObject() @IsOptional() thresholdConfig?: Record<string, unknown>;
    @IsArray() @IsString({ each: true }) @IsOptional() channelCodes?: string[];
    @IsObject() @IsOptional() escalationConfig?: Record<string, unknown>;
}

// ── Alert Channel DTOs ──

export class CreateAlertChannelDto {
    @IsString() @IsNotEmpty() @MaxLength(80) code!: string;
    @IsString() @IsNotEmpty() @MaxLength(120) name!: string;
    @IsEnum(ALERT_CHANNEL_TYPES) type!: (typeof ALERT_CHANNEL_TYPES)[number];
    @IsEnum(ALERT_CHANNEL_STATUSES) @IsOptional()
    status?: (typeof ALERT_CHANNEL_STATUSES)[number];
    @IsObject() @IsOptional() config?: Record<string, unknown>;
}

export class UpdateAlertChannelDto {
    @IsString() @IsOptional() @MaxLength(120) name?: string;
    @IsEnum(ALERT_CHANNEL_STATUSES) @IsOptional()
    status?: (typeof ALERT_CHANNEL_STATUSES)[number];
    @IsObject() @IsOptional() config?: Record<string, unknown>;
}

// ── Test Alert DTO ──

export class TestAlertDto {
    @IsString() @IsOptional() ruleCode?: string;
    @IsArray() @IsString({ each: true }) @ArrayMinSize(1) channelCodes!: string[];
    @IsEnum(ALERT_SEVERITIES) @IsOptional() severity?: (typeof ALERT_SEVERITIES)[number];
    @IsString() @IsOptional() @MaxLength(120) title?: string;
    @IsString() @IsOptional() @MaxLength(500) message?: string;
    @IsObject() @IsOptional() context?: Record<string, unknown>;
    @IsBoolean() @IsOptional() forceFailure?: boolean;
}

// ── Digest Schedule DTOs ──

export class CreateDigestScheduleDto {
    @IsString() @IsNotEmpty() @MaxLength(80) code!: string;
    @IsString() @IsNotEmpty() @MaxLength(120) name!: string;
    @IsString() @IsOptional() @MaxLength(500) description?: string;
    @IsString() @IsNotEmpty() @MaxLength(60) digestType!: string;
    @IsEnum(DIGEST_FREQUENCIES) frequency!: (typeof DIGEST_FREQUENCIES)[number];
    @IsInt() @Min(0) @Max(23) @IsOptional() hourLocal?: number;
    @IsInt() @Min(0) @Max(6) @IsOptional() dayOfWeek?: number;
    @IsString() @IsOptional() @MaxLength(60) timezone?: string;
    @IsArray() @IsString({ each: true }) @ArrayMinSize(1) channelCodes!: string[];
    @IsString() @IsOptional() branchId?: string;
    @IsEnum(DIGEST_SCHEDULE_STATUSES) @IsOptional()
    status?: (typeof DIGEST_SCHEDULE_STATUSES)[number];
}

export class UpdateDigestScheduleDto {
    @IsString() @IsOptional() @MaxLength(120) name?: string;
    @IsString() @IsOptional() @MaxLength(500) description?: string;
    @IsEnum(DIGEST_FREQUENCIES) @IsOptional() frequency?: (typeof DIGEST_FREQUENCIES)[number];
    @IsInt() @Min(0) @Max(23) @IsOptional() hourLocal?: number;
    @IsInt() @Min(0) @Max(6) @IsOptional() dayOfWeek?: number;
    @IsArray() @IsString({ each: true }) @IsOptional() channelCodes?: string[];
    @IsEnum(DIGEST_SCHEDULE_STATUSES) @IsOptional()
    status?: (typeof DIGEST_SCHEDULE_STATUSES)[number];
}

// ── Listing query DTOs ──

export class ListDeliveriesQueryDto {
    @IsString() @IsOptional() status?: string;
    @IsString() @IsOptional() ruleCode?: string;
    @IsInt() @Min(1) @Max(200) @IsOptional() limit?: number;
}

export class OwnerLiveQueryDto {
    @IsInt() @Min(1) @Max(100) @IsOptional() limit?: number;
    @IsString() @IsOptional() since?: string;
    @IsString() @IsOptional() severity?: string;
}
