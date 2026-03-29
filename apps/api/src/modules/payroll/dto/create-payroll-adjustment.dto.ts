import { IsString, IsEnum, IsNumber, IsOptional, IsDateString, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { PayrollAdjustmentType } from '@prisma/client';

export class CreatePayrollAdjustmentDto {
    @IsString()
    employeeId!: string;

    @IsOptional()
    @IsString()
    payComponentId?: string;

    @IsEnum(PayrollAdjustmentType)
    adjustmentType!: PayrollAdjustmentType;

    @IsNumber({ maxDecimalPlaces: 2 })
    @Type(() => Number)
    amount!: number;

    @IsDateString()
    effectiveDate!: string;

    @IsOptional()
    @IsString()
    @MaxLength(1000)
    notes?: string;
}
