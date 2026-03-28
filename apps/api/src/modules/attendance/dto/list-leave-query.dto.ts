import { IsOptional, IsString, IsEnum, IsNumberString } from 'class-validator';
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
}
