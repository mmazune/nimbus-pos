import { IsOptional, IsString } from 'class-validator';

export class RiskDashboardQueryDto {
  @IsOptional()
  @IsString()
  userId?: string;
}
