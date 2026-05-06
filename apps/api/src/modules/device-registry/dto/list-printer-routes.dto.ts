import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import type { PrinterRouteType } from '@prisma/client';

export class ListPrinterRoutesDto {
    @IsOptional()
    @IsEnum(['RECEIPT', 'KITCHEN', 'BAR'] as const)
    routeType?: PrinterRouteType;

    @IsOptional()
    @IsString()
    @MaxLength(64)
    printerId?: string;

    @IsOptional()
    @IsString()
    @MaxLength(80)
    station?: string;

    @IsOptional()
    @Type(() => Boolean)
    @IsBoolean()
    enabledOnly?: boolean;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number = 1;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(200)
    pageSize?: number = 100;
}
