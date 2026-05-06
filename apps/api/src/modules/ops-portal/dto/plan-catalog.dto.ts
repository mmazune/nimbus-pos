import {
    IsString,
    IsNotEmpty,
    IsOptional,
    IsNumber,
    IsBoolean,
    IsIn,
    Min,
    Max,
    Matches,
} from 'class-validator';

// ── M39 Plan-Catalog Correction ──
// Internal-only DTOs for the Nimbus Ops portal. These endpoints are NOT
// exposed to merchants or developers — they are reserved for Nimbus
// internal admins managing the SaaS plan catalog.

export class CreateOpsPlanDto {
    @IsString() @IsNotEmpty()
    @Matches(/^[a-z][a-z0-9_-]*$/, {
        message: 'code must be lowercase alphanumeric with optional hyphens/underscores',
    })
    code!: string;

    @IsString() @IsNotEmpty() name!: string;

    @IsString() @IsOptional() description?: string;

    @IsNumber() @Min(0) priceMonthly!: number;

    @IsNumber() @Min(0) priceAnnual!: number;

    /**
     * Maximum number of active locations (branches) this plan allows.
     * This is the ONLY commercial cap enforced by the platform.
     */
    @IsNumber() @Min(1) @Max(999_999) maxLocations!: number;

    @IsNumber() @IsOptional() @Min(0) trialDays?: number;

    @IsNumber() @IsOptional() @Min(0) gracePeriodDays?: number;

    @IsString() @IsOptional()
    @IsIn(['basic', 'standard', 'priority'])
    supportTier?: string;

    @IsNumber() @IsOptional() sortOrder?: number;
}

export class UpdateOpsPlanDto {
    @IsString() @IsOptional() name?: string;
    @IsString() @IsOptional() description?: string;
    @IsNumber() @IsOptional() @Min(0) priceMonthly?: number;
    @IsNumber() @IsOptional() @Min(0) priceAnnual?: number;
    @IsNumber() @IsOptional() @Min(1) @Max(999_999) maxLocations?: number;
    @IsNumber() @IsOptional() @Min(0) trialDays?: number;
    @IsNumber() @IsOptional() @Min(0) gracePeriodDays?: number;
    @IsString() @IsOptional() @IsIn(['basic', 'standard', 'priority']) supportTier?: string;
    @IsNumber() @IsOptional() sortOrder?: number;
}

export class UpdateOpsPlanStatusDto {
    @IsString() @IsIn(['ACTIVE', 'ARCHIVED', 'DRAFT']) status!: 'ACTIVE' | 'ARCHIVED' | 'DRAFT';
    @IsBoolean() @IsOptional() force?: boolean;
}
