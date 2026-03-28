import {
    IsString,
    IsOptional,
    IsEnum,
    IsDateString,
    IsObject,
    MaxLength,
    IsNumber,
} from 'class-validator';
import { ContractStatus, SalaryBasis } from '@prisma/client';
import { Type } from 'class-transformer';

export class CreateContractDto {
    @IsString()
    employeeId!: string;

    @IsString()
    @IsOptional()
    @MaxLength(50)
    contractNumber?: string;

    @IsEnum(ContractStatus)
    @IsOptional()
    contractStatus?: ContractStatus;

    @IsDateString()
    startsAt!: string;

    @IsDateString()
    @IsOptional()
    endsAt?: string;

    @IsEnum(SalaryBasis)
    salaryBasis!: SalaryBasis;

    @IsNumber({ maxDecimalPlaces: 2 })
    @IsOptional()
    @Type(() => Number)
    salaryAmount?: number;

    @IsString()
    @IsOptional()
    termsSummary?: string;

    @IsObject()
    @IsOptional()
    metadata?: Record<string, any>;
}
