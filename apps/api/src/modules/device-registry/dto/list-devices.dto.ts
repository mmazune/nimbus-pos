import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import type { DeviceStatus, DeviceType } from '@prisma/client';

export class ListDevicesDto {
    @IsOptional()
    @IsEnum([
        'POS_TERMINAL',
        'KDS_SCREEN',
        'PRINTER',
        'PAYMENT_TERMINAL_STUB',
    ] as const)
    type?: DeviceType;

    @IsOptional()
    @IsEnum(['ACTIVE', 'INACTIVE', 'DISABLED', 'RETIRED'] as const)
    status?: DeviceStatus;

    @IsOptional()
    @IsString()
    @MaxLength(80)
    station?: string;

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
    pageSize?: number = 50;
}
