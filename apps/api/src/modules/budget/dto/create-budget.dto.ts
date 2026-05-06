import {
  IsString,
  IsOptional,
  IsEnum,
  IsDateString,
  IsArray,
  ValidateNested,
  IsNumber,
  Min,
  IsNotEmpty,
  MaxLength,
  IsInt,
  IsPositive,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum BudgetTypeDto {
  OPERATIONAL = 'OPERATIONAL',
  FINANCIAL = 'FINANCIAL',
}

export class CreateBudgetLineDto {
  /** Category label for this budget line (e.g. 'Food Cost', 'Labour', 'Rent'). */
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  category!: string;

  /** Optional sub-dimension label (e.g. 'Kitchen', 'Management'). */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  dimension?: string;

  /** GL account ID this line maps to (for actuals pull). */
  @IsOptional()
  @IsString()
  accountId?: string;

  /** Cost centre ID for departmental attribution. */
  @IsOptional()
  @IsString()
  costCenterId?: string;

  /** Planned budget amount in functional currency. */
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  budgetAmount!: number;
}

export class CreateBudgetDto {
  /** Human-readable name for the budget. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  name!: string;

  /** ISO date string for start of budget period. */
  @IsDateString()
  periodStart!: string;

  /** ISO date string for end of budget period. */
  @IsDateString()
  periodEnd!: string;

  @IsOptional()
  @IsEnum(BudgetTypeDto)
  budgetType?: BudgetTypeDto;

  /** Optional fiscal period link. */
  @IsOptional()
  @IsString()
  fiscalPeriodId?: string;

  /** Budget version number. Defaults to 1. */
  @IsOptional()
  @IsInt()
  @IsPositive()
  version?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateBudgetLineDto)
  lines!: CreateBudgetLineDto[];
}
