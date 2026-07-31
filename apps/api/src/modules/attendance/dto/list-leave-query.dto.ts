import {
  IsOptional,
  IsString,
  IsEnum,
  IsBoolean,
  IsInt,
  Min,
  Max,
  IsDateString,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
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

  // Bounded History window: inclusive createdAt range (ISO date/datetime).
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  // Query params arrive as strings; @Type coerces before @IsInt runs (the
  // global ValidationPipe transforms but does not implicitly convert). Bounds
  // prevent unbounded history reads (Max 100). Mirrors the Prompt 3D discounts
  // DTO fix (SUP-RG-032).
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  take?: number;

  /**
   * Waiter MVP: when `true`, restrict results to the authenticated user's own
   * employee record. Overrides any `employeeId` passed in.
   */
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  mine?: boolean;
}
