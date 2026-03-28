import { IsOptional, IsString, IsEnum, IsNumberString } from 'class-validator';
import { ContractStatus, SalaryBasis } from '@prisma/client';

export class ListContractsQueryDto {
  @IsOptional()
  @IsString()
  employeeId?: string;

  @IsOptional()
  @IsEnum(ContractStatus)
  contractStatus?: ContractStatus;

  @IsOptional()
  @IsEnum(SalaryBasis)
  salaryBasis?: SalaryBasis;

  @IsOptional()
  @IsNumberString()
  skip?: string;

  @IsOptional()
  @IsNumberString()
  take?: string;
}
