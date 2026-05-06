import { IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * BG5 — Pair a PAYMENT_TERMINAL_STUB device to a POS_TERMINAL device.
 * Stub-only: this is registry/configuration metadata. No live card-terminal
 * traffic is attempted. The response makes the stub nature explicit
 * (`mode: 'STUB'`).
 */
export class PairTerminalDto {
    /** ID of an existing PAYMENT_TERMINAL_STUB device in the same branch. */
    @IsString()
    @MinLength(1)
    @MaxLength(64)
    terminalDeviceId!: string;

    /** ID of the POS_TERMINAL device the terminal is paired to. */
    @IsString()
    @MinLength(1)
    @MaxLength(64)
    pairedToDeviceId!: string;

    /** Caller-tagged provider identifier (informational only — not validated against any provider). */
    @IsOptional()
    @IsString()
    @MaxLength(80)
    provider?: string;

    @IsOptional()
    @IsObject()
    metadata?: Record<string, unknown>;
}
