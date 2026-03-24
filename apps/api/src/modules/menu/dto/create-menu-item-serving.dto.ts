import {
  IsString,
  MaxLength,
  IsOptional,
  IsBoolean,
  IsInt,
  IsEnum,
  IsNumber,
  IsObject,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ServingFormat } from '@prisma/client';

export class CreateMenuItemServingDto {
  @IsEnum(ServingFormat)
  format!: ServingFormat;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  label?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  price!: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  volumeText?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
