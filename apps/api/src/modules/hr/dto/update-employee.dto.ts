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

export class UpdateEmployeeDto {
  @IsString()
  @IsOptional()
  @MaxLength(100)
  firstName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  lastName?: string;

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

  @IsEnum(EmployeeStatus)
  @IsOptional()
  status?: EmployeeStatus;

  @IsEnum(EmploymentType)
  @IsOptional()
  employmentType?: EmploymentType;

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
