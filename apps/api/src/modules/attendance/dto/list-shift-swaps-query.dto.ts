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
import { ShiftSwapStatus } from '@prisma/client';

export class ListShiftSwapsQueryDto {
  @IsOptional()
  @IsString()
  employeeId?: string;

  @IsOptional()
  @IsEnum(ShiftSwapStatus)
  status?: ShiftSwapStatus;

  // Bounded History window: inclusive createdAt range (ISO date/datetime).
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  // Coerced + bounded (Max 100) — mirrors the Prompt 3D discounts DTO fix
  // (SUP-RG-032); prevents unbounded history reads.
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
   * Waiter MVP: when `true`, restrict results to swaps the authenticated user is
   * party to (either requester or target). Overrides any `employeeId`.
   */
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  mine?: boolean;
}
