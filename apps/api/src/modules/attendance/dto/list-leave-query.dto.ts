import { IsOptional, IsString, IsEnum, IsNumberString, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';
import { LeaveRequestStatus, LeaveType } from '@prisma/client';

export class ListLeaveQueryDto {
  @IsOptional()
  @IsString()
  employeeId?: string;

  @IsOptional()
  @IsEnum(LeaveRequestStatus)
  status?: LeaveRequestStatus;

  @IsOptional()
  @IsEnum(LeaveType)
  leaveType?: LeaveType;

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
