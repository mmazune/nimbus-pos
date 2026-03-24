import {
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsEnum,
  IsInt,
  IsObject,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MenuItemType, PrepStation } from '@prisma/client';

export class CreateMenuItemDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsString()
  categoryId!: string;

  @IsOptional()
  @IsString()
  taxCategoryId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  sku?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  price!: number;

  @IsEnum(MenuItemType)
  itemType!: MenuItemType;

  @IsOptional()
  @IsEnum(PrepStation)
  station?: PrepStation;

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
