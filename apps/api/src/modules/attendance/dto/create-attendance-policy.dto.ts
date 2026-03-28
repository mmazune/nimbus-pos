import { IsString, IsOptional, IsInt, IsBoolean, MaxLength, Min, Max } from 'class-validator';

export class CreateAttendancePolicyDto {
    @IsString()
    @MaxLength(200)
    name!: string;

    @IsInt()
    @Min(0)
    @Max(120)
    @IsOptional()
    graceMinutes?: number;

    @IsInt()
    @Min(1)
    @Max(480)
    @IsOptional()
    autoLateAfterMinutes?: number;

    @IsBoolean()
    @IsOptional()
    allowSelfClockOutFix?: boolean;
}
