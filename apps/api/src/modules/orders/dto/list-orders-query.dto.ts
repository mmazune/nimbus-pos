import { IsOptional, IsString, IsEnum, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ListOrdersQueryDto {
  @IsOptional()
  @IsEnum(['NEW', 'SENT', 'IN_KITCHEN', 'READY', 'SERVED', 'VOIDED', 'CLOSED'])
  status?: string;

  @IsOptional()
  @IsEnum(['DINE_IN', 'TAKEAWAY'])
  serviceType?: string;

  @IsOptional()
  @IsString()
  tableId?: string;

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
