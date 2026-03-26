import { IsOptional, IsEnum, IsInt, IsString, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

export class ListEventsQueryDto {
  @IsOptional()
  @IsEnum(['DRAFT', 'PUBLISHED', 'OPEN', 'CLOSED', 'CANCELLED', 'COMPLETED'])
  status?: string;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  pageSize?: number;
}
