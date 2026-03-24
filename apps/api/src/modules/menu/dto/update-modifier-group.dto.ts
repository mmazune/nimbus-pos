import { IsString, MinLength, MaxLength, IsOptional, IsBoolean, IsInt, Min } from 'class-validator';

export class UpdateModifierGroupDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  min?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  max?: number;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
