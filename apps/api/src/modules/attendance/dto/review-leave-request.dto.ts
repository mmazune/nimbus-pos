import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { LeaveRequestStatus } from '@prisma/client';

export class ReviewLeaveRequestDto {
  @IsEnum(LeaveRequestStatus, {
    message: 'status must be APPROVED or REJECTED',
  })
  status!: LeaveRequestStatus;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  reviewNotes?: string;
}
