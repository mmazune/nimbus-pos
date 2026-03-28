import { IsOptional, IsString, IsEnum, IsNumberString } from 'class-validator';
import { ShiftSwapStatus } from '@prisma/client';

export class ListShiftSwapsQueryDto {
  @IsOptional()
  @IsString()
  employeeId?: string;

  @IsOptional()
  @IsEnum(ShiftSwapStatus)
  status?: ShiftSwapStatus;

  @IsOptional()
  @IsNumberString()
  skip?: string;

  @IsOptional()
  @IsNumberString()
  take?: string;
}
