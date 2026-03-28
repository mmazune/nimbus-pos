import { IsString, IsOptional, IsDateString, MaxLength } from 'class-validator';

export class CreateShiftSwapDto {
    @IsString()
    requesterEmployeeId!: string;

    @IsString()
    targetEmployeeId!: string;

    @IsDateString()
    shiftDate!: string;

    @IsString()
    @IsOptional()
    @MaxLength(1000)
    reason?: string;
}
