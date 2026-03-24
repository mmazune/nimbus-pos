import { IsOptional, IsBoolean, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

export class ListMenuQueryDto {
  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  activeOnly?: boolean;
}
