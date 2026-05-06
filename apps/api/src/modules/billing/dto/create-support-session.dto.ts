import { IsString, IsOptional, IsDateString } from 'class-validator';

export class CreateSupportSessionDto {
    @IsString()
    reason!: string;

    @IsOptional()
    @IsDateString()
    expiresAt?: string;

    @IsOptional()
    @IsString()
    notes?: string;
}
