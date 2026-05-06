import { IsOptional, IsEnum, IsDateString, IsString } from 'class-validator';

export enum AnalyticsWindowTypeDto {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  CUSTOM = 'CUSTOM',
}

export enum MetricFamilyDto {
  REVENUE = 'REVENUE',
  COGS = 'COGS',
  GROSS_PROFIT = 'GROSS_PROFIT',
  LABOR = 'LABOR',
  PRIME_COST = 'PRIME_COST',
  OVERHEAD = 'OVERHEAD',
  UTILITIES = 'UTILITIES',
  REPAIRS = 'REPAIRS',
  BUDGET_VARIANCE = 'BUDGET_VARIANCE',
  AP_EXPOSURE = 'AP_EXPOSURE',
}

export enum ScorecardDomainDto {
  FINANCIAL = 'FINANCIAL',
  PRIME_COST = 'PRIME_COST',
  WASTE_VARIANCE = 'WASTE_VARIANCE',
  STOCK_HEALTH = 'STOCK_HEALTH',
  PROCUREMENT_READINESS = 'PROCUREMENT_READINESS',
  DEMAND_READINESS = 'DEMAND_READINESS',
  OPERATIONAL_RISK = 'OPERATIONAL_RISK',
}

export enum DeepRankingTypeDto {
  REVENUE = 'REVENUE',
  BUDGET_VARIANCE = 'BUDGET_VARIANCE',
  STOCK_HEALTH = 'STOCK_HEALTH',
  PROCUREMENT_PREPAREDNESS = 'PROCUREMENT_PREPAREDNESS',
  DEMAND_READINESS = 'DEMAND_READINESS',
  PRIME_COST = 'PRIME_COST',
  WASTE_EFFICIENCY = 'WASTE_EFFICIENCY',
  THEORETICAL_VARIANCE = 'THEORETICAL_VARIANCE',
  GROSS_MARGIN = 'GROSS_MARGIN',
  LABOR_EFFICIENCY = 'LABOR_EFFICIENCY',
  OVERALL_FINANCIAL_DISCIPLINE = 'OVERALL_FINANCIAL_DISCIPLINE',
}

export class ConsolidatedFinanceQueryDto {
  @IsOptional()
  @IsEnum(AnalyticsWindowTypeDto)
  windowType?: AnalyticsWindowTypeDto;

  @IsOptional()
  @IsDateString()
  windowStart?: string;

  @IsOptional()
  @IsDateString()
  windowEnd?: string;
}

export class ScorecardsQueryDto {
  @IsOptional()
  @IsEnum(AnalyticsWindowTypeDto)
  windowType?: AnalyticsWindowTypeDto;

  @IsOptional()
  @IsDateString()
  windowStart?: string;

  @IsOptional()
  @IsDateString()
  windowEnd?: string;

  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsEnum(ScorecardDomainDto)
  domain?: ScorecardDomainDto;
}

export class WasteBenchmarkQueryDto {
  @IsOptional()
  @IsEnum(AnalyticsWindowTypeDto)
  windowType?: AnalyticsWindowTypeDto;

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

export class FinancialComparisonQueryDto {
  @IsOptional()
  @IsEnum(AnalyticsWindowTypeDto)
  windowType?: AnalyticsWindowTypeDto;

  @IsOptional()
  @IsDateString()
  windowStart?: string;

  @IsOptional()
  @IsDateString()
  windowEnd?: string;
}

export class DeepRankingsQueryDto {
  @IsOptional()
  @IsEnum(AnalyticsWindowTypeDto)
  windowType?: AnalyticsWindowTypeDto;

  @IsOptional()
  @IsDateString()
  windowStart?: string;

  @IsOptional()
  @IsDateString()
  windowEnd?: string;

  @IsOptional()
  @IsEnum(DeepRankingTypeDto)
  rankingType?: DeepRankingTypeDto;
}

export class DrilldownQueryDto {
  @IsOptional()
  @IsEnum(AnalyticsWindowTypeDto)
  windowType?: AnalyticsWindowTypeDto;

  @IsOptional()
  @IsDateString()
  windowStart?: string;

  @IsOptional()
  @IsDateString()
  windowEnd?: string;

  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsEnum(MetricFamilyDto)
  metricFamily?: MetricFamilyDto;
}
