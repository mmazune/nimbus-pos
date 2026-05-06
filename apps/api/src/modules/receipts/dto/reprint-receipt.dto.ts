import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ReprintReceiptDto {
    @IsOptional()
    @IsString()
    @MaxLength(280)
    reason?: string;

    /** Number of physical copies the cashier requested. Defaults to 1. */
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(10)
    copies?: number;
}
