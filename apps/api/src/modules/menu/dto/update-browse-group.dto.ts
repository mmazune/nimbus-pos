import {
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  IsBoolean,
  IsInt,
  IsEnum,
  Min,
} from 'class-validator';
import { MenuSection } from '@prisma/client';

export class UpdateBrowseGroupDto {
  @IsOptional()
  @IsEnum(MenuSection)
  section?: MenuSection;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  internalKey?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
