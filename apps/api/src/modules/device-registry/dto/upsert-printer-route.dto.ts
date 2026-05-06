import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import type { PrinterRouteType } from '@prisma/client';

/**
 * BG5 — Upsert a printer route. Uniqueness key is
 * (branchId, routeType, station, printerId). Re-posting the same combination
 * is duplicate-safe (returns the existing row with `enabled` / `priority`
 * patched if changed). The endpoint is also BG3-wrapped for `Idempotency-Key`.
 */
export class UpsertPrinterRouteDto {
    @IsString()
    @MinLength(1)
    @MaxLength(64)
    printerId!: string;

    @IsEnum(['RECEIPT', 'KITCHEN', 'BAR'] as const)
    routeType!: PrinterRouteType;

    @IsOptional()
    @IsString()
    @MaxLength(80)
    station?: string;

    @IsOptional()
    @IsBoolean()
    enabled?: boolean = true;

    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(1000)
    priority?: number = 100;
}
