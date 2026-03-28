import { IsOptional, IsString, IsEnum, IsNumberString } from 'class-validator';
import { EmployeeStatus, EmploymentType } from '@prisma/client';

export class ListEmployeesQueryDto {
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
