import { IsString, IsOptional, IsBoolean, IsObject, MaxLength, MinLength } from 'class-validator';

export class UpdateFloorPlanDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
