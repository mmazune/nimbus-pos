import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import type { DeviceStatus } from '@prisma/client';

/** BG5 — Update device status (ACTIVE / INACTIVE / DISABLED / RETIRED). */
export class UpdateDeviceStatusDto {
    @IsEnum(['ACTIVE', 'INACTIVE', 'DISABLED', 'RETIRED'] as const)
    status!: DeviceStatus;

    @IsOptional()
    @IsString()
    @MaxLength(280)
    reason?: string;
}
