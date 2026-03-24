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

export class CreateBrowseGroupDto {
  @IsEnum(MenuSection)
  section!: MenuSection;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  internalKey?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
