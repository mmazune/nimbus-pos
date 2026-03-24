import { IsOptional, IsEnum, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';
import { MenuSection } from '@prisma/client';

export class ListMenuNavigationQueryDto {
  @IsOptional()
  @IsEnum(MenuSection)
  section?: MenuSection;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  activeOnly?: boolean;
}
