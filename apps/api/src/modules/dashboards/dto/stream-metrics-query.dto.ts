import { IsOptional, IsString } from 'class-validator';

export class StreamMetricsQueryDto {
  @IsOptional()
  @IsString()
  branchId?: string;
}
