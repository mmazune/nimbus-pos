import { IsString, IsOptional, IsEnum, IsDateString, MaxLength } from 'class-validator';
import { LeaveType } from '@prisma/client';

export class CreateLeaveRequestDto {
  @IsString()
  employeeId!: string;

  @IsEnum(LeaveType)
  leaveType!: LeaveType;

  @IsDateString()
  startsAt!: string;

  @IsDateString()
  endsAt!: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  reason?: string;
}
