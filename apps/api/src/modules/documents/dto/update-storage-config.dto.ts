import { IsOptional, IsBoolean, IsString, IsObject } from 'class-validator';

export class UpdateStorageConfigDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsString()
  bucketOrContainer?: string;

  @IsOptional()
  @IsString()
  basePath?: string;

  @IsOptional()
  @IsString()
  publicBaseUrl?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
