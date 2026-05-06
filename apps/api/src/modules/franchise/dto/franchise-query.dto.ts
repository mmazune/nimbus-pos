import { IsString, IsOptional, IsEnum, IsDateString } from 'class-validator';

export enum FranchiseWindowTypeDto {
    DAILY = 'DAILY',
    WEEKLY = 'WEEKLY',
    MONTHLY = 'MONTHLY',
    QUARTERLY = 'QUARTERLY',
    CUSTOM = 'CUSTOM',
}

export enum FranchiseRankingTypeDto {
    REVENUE = 'REVENUE',
    BUDGET_VARIANCE = 'BUDGET_VARIANCE',
    FORECAST_ACCURACY = 'FORECAST_ACCURACY',
    PROCUREMENT_PREPAREDNESS = 'PROCUREMENT_PREPAREDNESS',
    STOCK_HEALTH = 'STOCK_HEALTH',
    DEMAND_READINESS = 'DEMAND_READINESS',
}

export class FranchiseOverviewQueryDto {
    @IsOptional()
    @IsEnum(FranchiseWindowTypeDto)
    windowType?: FranchiseWindowTypeDto;

    @IsOptional()
    @IsDateString()
    windowStart?: string;

    @IsOptional()
    @IsDateString()
    windowEnd?: string;
}

export class FranchiseRankingsQueryDto {
    @IsOptional()
    @IsEnum(FranchiseRankingTypeDto)
    rankingType?: FranchiseRankingTypeDto;

    @IsOptional()
    @IsEnum(FranchiseWindowTypeDto)
    windowType?: FranchiseWindowTypeDto;

    @IsOptional()
    @IsDateString()
    windowStart?: string;

    @IsOptional()
    @IsDateString()
    windowEnd?: string;
}

export class FranchiseBudgetsQueryDto {
    @IsOptional()
    @IsEnum(FranchiseWindowTypeDto)
    windowType?: FranchiseWindowTypeDto;

    @IsOptional()
    @IsDateString()
    windowStart?: string;

    @IsOptional()
    @IsDateString()
    windowEnd?: string;

    @IsOptional()
    @IsString()
    branchId?: string;
}
