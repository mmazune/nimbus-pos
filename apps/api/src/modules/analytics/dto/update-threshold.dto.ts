import { IsOptional, IsString, IsNumber, IsInt, IsBoolean, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateThresholdDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  value?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  intValue?: number;

  @IsOptional()
  @IsBoolean()
  boolValue?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  unit?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;
}
