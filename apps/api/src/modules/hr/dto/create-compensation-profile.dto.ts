import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsBoolean,
  IsObject,
  MaxLength,
} from 'class-validator';
import { SalaryBasis } from '@prisma/client';
import { Type } from 'class-transformer';

export class CreateCompensationProfileDto {
  @IsString()
  @MaxLength(30)
  code!: string;

  @IsEnum(SalaryBasis)
  salaryBasis!: SalaryBasis;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsOptional()
  @Type(() => Number)
  baseAmount?: number;

  @IsString()
  @IsOptional()
  @MaxLength(10)
  currency?: string;

  @IsObject()
  @IsOptional()
  allowances?: Record<string, any>;

  @IsObject()
  @IsOptional()
  deductions?: Record<string, any>;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsBoolean()
  @IsOptional()
  active?: boolean;
}
