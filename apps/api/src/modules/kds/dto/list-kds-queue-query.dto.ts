import { IsOptional, IsString, IsEnum, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ListKdsQueueQueryDto {
  @IsOptional()
  @IsString()
  station?: string;

  @IsOptional()
  @IsEnum(['QUEUED', 'READY', 'RECALLED'])
  status?: string;

  // T2 phase 3 (E5): only the tickets of one order (made for it, or holding its lines now)
  @IsOptional()
  @IsString()
  orderId?: string;

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
