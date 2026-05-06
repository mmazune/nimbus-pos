import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * BG4.A — Receipt delivery channels.
 *
 * NONE of these channels are wired to a live provider in the current
 * Nimbus build. The send endpoint records a PENDING delivery request
 * and returns 202 with a `supported: false` marker so the frontend
 * can disable the corresponding UI affordances honestly.
 *
 * When a real adapter is wired in a later milestone the marker flips
 * to `supported: true` without changing the API contract.
 */
export const RECEIPT_CHANNELS = ['email', 'sms', 'whatsapp'] as const;
export type ReceiptChannel = (typeof RECEIPT_CHANNELS)[number];

export class SendReceiptDto {
    @IsEnum(RECEIPT_CHANNELS as unknown as string[])
    channel!: ReceiptChannel;

    /** Recipient identifier (email address, MSISDN, or WhatsApp number). */
    @IsString()
    @MinLength(3)
    @MaxLength(160)
    recipient!: string;

    @IsOptional()
    @IsString()
    @MaxLength(8)
    locale?: string;

    @IsOptional()
    @IsString()
    @MaxLength(280)
    note?: string;
}
