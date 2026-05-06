import { IsOptional, IsEnum, IsString, IsDateString } from 'class-validator';

export enum BudgetStatusFilterDto {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  FINALIZED = 'FINALIZED',
  ARCHIVED = 'ARCHIVED',
}

export enum BudgetTypeFilterDto {
  OPERATIONAL = 'OPERATIONAL',
  FINANCIAL = 'FINANCIAL',
}

export class ListBudgetsQueryDto {
  @IsOptional()
  @IsEnum(BudgetStatusFilterDto)
  status?: BudgetStatusFilterDto;

  @IsOptional()
  @IsEnum(BudgetTypeFilterDto)
  budgetType?: BudgetTypeFilterDto;

  @IsOptional()
  @IsString()
  fiscalPeriodId?: string;

  @IsOptional()
  @IsDateString()
  periodStart?: string;

  @IsOptional()
  @IsDateString()
  periodEnd?: string;
}
