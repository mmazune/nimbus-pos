import { IsOptional, IsString, IsBoolean, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ListShiftTemplatesQueryDto {
    @IsOptional()
    @IsBoolean()
    @Type(() => Boolean)
    active?: boolean;

    @IsOptional()
    @IsString()
    roleKey?: string;

    @IsOptional()
    @IsString()
    positionId?: string;

    @IsOptional()
    @IsString()
    search?: string;

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
