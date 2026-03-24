import { IsOptional, IsString, IsEnum, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ListKdsQueueQueryDto {
  @IsOptional()
  @IsString()
  station?: string;

  @IsOptional()
  @IsEnum(['QUEUED', 'READY', 'RECALLED'])
  status?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number;
}
