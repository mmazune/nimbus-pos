import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UnpairTerminalDto {
    @IsOptional()
    @IsString()
    @MaxLength(280)
    reason?: string;
}
