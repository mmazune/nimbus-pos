import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CloseShiftDto {
    @IsOptional()
    @IsString()
    @MaxLength(500)
    notes?: string;
}
