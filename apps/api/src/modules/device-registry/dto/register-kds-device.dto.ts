import { IsEnum, IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * BG5 — KDS-screen registration helper. Sugar over POST /api/devices/activate
 * for the KDS shell so frontend code does not have to know to set
 * `type: KDS_SCREEN` explicitly. Returns the same Device contract.
 */
export class RegisterKdsDeviceDto {
    @IsString()
    @MinLength(1)
    @MaxLength(120)
    name!: string;

    /** KDS station this screen primarily owns (e.g. 'GRILL', 'EXPO', 'BAR'). */
    @IsString()
    @MinLength(1)
    @MaxLength(80)
    station!: string;

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
}
