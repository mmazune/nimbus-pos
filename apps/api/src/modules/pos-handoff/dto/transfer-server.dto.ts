import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * BG4.B — Reassign an open order to a different server (waiter/cashier)
 * who has an active membership in the same branch.
 */
export class TransferServerDto {
    @IsString()
    targetUserId!: string;

    @IsOptional()
    @IsString()
    @MaxLength(200)
    reason?: string;
}
