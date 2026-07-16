import { IsOptional, IsString, IsEnum, IsNumberString, IsDateString, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';
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

  /**
   * Waiter MVP: when `true`, restrict results to the authenticated user's own
   * employee record. Overrides any `employeeId` passed in.
   */
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  mine?: boolean;
}
