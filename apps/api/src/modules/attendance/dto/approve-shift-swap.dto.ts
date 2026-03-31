import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ShiftSwapStatus } from '@prisma/client';

export class ApproveShiftSwapDto {
  @IsEnum(ShiftSwapStatus, {
    message: 'status must be APPROVED or REJECTED',
  })
  status!: ShiftSwapStatus;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  reviewNotes?: string;
}
