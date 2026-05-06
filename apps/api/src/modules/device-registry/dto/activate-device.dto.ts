import { IsEnum, IsInt, IsObject, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';
import type { DeviceType } from '@prisma/client';

/**
 * BG5 — Activate (register) a new operational device.
 *
 * Activation is duplicate-safe in two ways:
 *   1. `activationCode` is globally unique. A repeat activation with the same
 *      code returns the existing device row instead of erroring.
 *   2. The endpoint is wrapped by the BG3 facade so an `Idempotency-Key`
 *      header replays the same response body byte-for-byte.
 */
export class ActivateDeviceDto {
    @IsEnum([
        'POS_TERMINAL',
        'KDS_SCREEN',
        'PRINTER',
        'PAYMENT_TERMINAL_STUB',
    ] as const)
    type!: DeviceType;

    @IsString()
    @MinLength(1)
    @MaxLength(120)
    name!: string;

    /** Free-form station/workspace binding (e.g. 'GRILL', 'BAR-1', 'COUNTER'). */
    @IsOptional()
    @IsString()
    @MaxLength(80)
    station?: string;

    /**
     * Caller-supplied pairing reference. If omitted, the service generates one
     * (`act-${cuid}`). When supplied, the service treats the activation as
     * idempotent against this code.
     */
    @IsOptional()
    @IsString()
    @MinLength(4)
    @MaxLength(120)
    activationCode?: string;

    @IsOptional()
    @IsObject()
    capabilities?: Record<string, unknown>;

    @IsOptional()
    @IsObject()
    metadata?: Record<string, unknown>;

    @IsOptional()
    @IsInt()
    @Min(0)
    placeholder?: number;
}
