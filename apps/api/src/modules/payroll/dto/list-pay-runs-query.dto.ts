import { IsEnum, IsOptional, IsDateString, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export enum PayRunStatusFilter {
    DRAFT = 'DRAFT',
    APPROVED = 'APPROVED',
    PAID = 'PAID',
    CANCELLED = 'CANCELLED',
}

export class ListPayRunsQueryDto {
    @IsOptional()
    @IsEnum(PayRunStatusFilter)
    status?: PayRunStatusFilter;

    @IsOptional()
    @IsDateString()
    periodStart?: string;

    @IsOptional()
    @IsDateString()
    periodEnd?: string;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(0)
    skip?: number;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    take?: number;
}
