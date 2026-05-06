import { IsOptional, IsString, MaxLength } from 'class-validator';

/** BG4.B — Move an order to a different table within the same branch. */
export class TransferTableDto {
    @IsString()
    targetTableId!: string;

    @IsOptional()
    @IsString()
    @MaxLength(200)
    reason?: string;
}
