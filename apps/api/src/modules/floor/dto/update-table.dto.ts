import {
  IsString,
  IsOptional,
  IsBoolean,
  IsObject,
  IsInt,
  IsEnum,
  MaxLength,
  MinLength,
  Min,
} from 'class-validator';
import { TableStatus } from '@prisma/client';

export class UpdateTableDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  label?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;

  @IsOptional()
  @IsString()
  floorPlanId?: string | null;

  @IsOptional()
  @IsEnum(TableStatus)
  status?: TableStatus;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
