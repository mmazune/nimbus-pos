import { IsOptional, IsString, IsEnum, IsNumberString, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';
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

  /**
   * Waiter MVP: when `true`, restrict results to swaps the authenticated user is
   * party to (either requester or target). Overrides any `employeeId`.
   */
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  mine?: boolean;
}
