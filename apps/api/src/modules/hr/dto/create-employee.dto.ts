import {
  IsString,
  IsOptional,
  IsEnum,
  IsDateString,
  IsObject,
  MaxLength,
  IsEmail,
} from 'class-validator';
import { EmployeeStatus, EmploymentType } from '@prisma/client';

export class CreateEmployeeDto {
  @IsString()
  @IsOptional()
  @MaxLength(50)
  employeeCode?: string;

  @IsString()
  @MaxLength(100)
  firstName!: string;

  @IsString()
  @MaxLength(100)
  lastName!: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  middleName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(30)
  phone?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsDateString()
  @IsOptional()
  dateOfBirth?: string;

  @IsDateString()
  hireDate!: string;

  @IsEnum(EmploymentType)
  employmentType!: EmploymentType;

  @IsEnum(EmployeeStatus)
  @IsOptional()
  status?: EmployeeStatus;

  @IsString()
  @IsOptional()
  userId?: string;

  @IsString()
  @IsOptional()
  positionId?: string;

  @IsString()
  @IsOptional()
  compensationProfileId?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  emergencyContactName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(30)
  emergencyContactPhone?: string;

  @IsObject()
  @IsOptional()
  address?: Record<string, any>;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}
