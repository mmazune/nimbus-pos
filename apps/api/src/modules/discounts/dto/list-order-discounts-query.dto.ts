import { Type } from 'class-transformer';
import { IsEnum, IsOptional, IsInt, Min, Max } from 'class-validator';

export class ListOrderDiscountsQueryDto {
  @IsOptional()
  @IsEnum(['PENDING', 'APPROVED', 'REJECTED'])
  status?: 'PENDING' | 'APPROVED' | 'REJECTED';

  // Query params arrive as strings; @Type coerces them to numbers before
  // @IsInt runs (the global ValidationPipe transforms but does not enable
  // implicit conversion). Mirrors list-orders-query.dto.ts. Without this,
  // any ?page/?pageSize (e.g. the UI's ?pageSize=50) 400s. (Prompt 3D fix.)
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}
