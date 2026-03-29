import { IsOptional, IsNumber, Min, Max } from 'class-validator';

export class UpdateStaffWeightsDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  salesWeight?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  reliabilityWeight?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  attendanceWeight?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  wastageWeight?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  riskPenaltyWeight?: number;
}
