import { IsOptional, IsString, IsEnum, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ListSchedulesQueryDto {
    @IsOptional()
    @IsEnum(['DRAFT', 'PUBLISHED', 'ARCHIVED'])
    status?: string;

    @IsOptional()
    @IsString()
    dateFrom?: string;

    @IsOptional()
    @IsString()
    dateTo?: string;

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
