import { IsOptional, IsString, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ListRosterQueryDto {
    @IsOptional()
    @IsString()
    dateFrom?: string;

    @IsOptional()
    @IsString()
    dateTo?: string;

    @IsOptional()
    @IsString()
    employeeId?: string;

    @IsOptional()
    @IsString()
    shiftTemplateId?: string;

    @IsOptional()
    @IsInt()
    @Min(0)
    @Type(() => Number)
    skip?: number;

    @IsOptional()
    @IsInt()
    @Min(1)
    @Type(() => Number)
    take?: number;
}
