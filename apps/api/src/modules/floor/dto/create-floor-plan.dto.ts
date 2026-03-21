import { IsString, IsOptional, IsBoolean, IsObject, MaxLength, MinLength } from 'class-validator';

export class CreateFloorPlanDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
