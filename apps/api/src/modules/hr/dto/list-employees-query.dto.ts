import { IsOptional, IsString, IsEnum, IsNumberString, IsIn } from 'class-validator';
import { EmployeeStatus, EmploymentType } from '@prisma/client';

export class ListEmployeesQueryDto {
  /**
   * C-02 — response projection. Omitted or `safe` returns the safe directory payload
   * (no compensation, no personal PII). `full` returns the historical payload and
   * requires `pos:hr:compensation:read`; without it the request is refused with 403.
   */
  @IsOptional()
  @IsIn(['safe', 'full'])
  view?: 'safe' | 'full';

  @IsOptional()
  @IsEnum(EmployeeStatus)
  status?: EmployeeStatus;

  @IsOptional()
  @IsEnum(EmploymentType)
  employmentType?: EmploymentType;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  positionId?: string;

  @IsOptional()
  @IsNumberString()
  skip?: string;

  @IsOptional()
  @IsNumberString()
  take?: string;
}
