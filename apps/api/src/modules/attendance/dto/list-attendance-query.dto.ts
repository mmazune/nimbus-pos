import { IsOptional, IsString, IsEnum, IsNumberString, IsDateString } from 'class-validator';
import { AttendanceStatus } from '@prisma/client';

export class ListAttendanceQueryDto {
    @IsOptional()
    @IsString()
    employeeId?: string;

    @IsOptional()
    @IsEnum(AttendanceStatus)
    status?: AttendanceStatus;

    @IsOptional()
    @IsDateString()
    dateFrom?: string;

    @IsOptional()
    @IsDateString()
    dateTo?: string;

    @IsOptional()
    @IsNumberString()
    skip?: string;

    @IsOptional()
    @IsNumberString()
    take?: string;
}
