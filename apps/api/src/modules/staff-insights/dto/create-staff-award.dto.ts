import { IsString, IsEnum, IsDateString, IsOptional } from 'class-validator';

export enum AwardTypeDto {
  EMPLOYEE_OF_MONTH = 'EMPLOYEE_OF_MONTH',
  RELIABILITY = 'RELIABILITY',
  SALES_EXCELLENCE = 'SALES_EXCELLENCE',
  CUSTOMER_DELIGHT = 'CUSTOMER_DELIGHT',
  TEAMWORK = 'TEAMWORK',
  OTHER = 'OTHER',
}

export class CreateStaffAwardDto {
  @IsString()
  employeeId!: string;

  @IsEnum(AwardTypeDto)
  awardType!: AwardTypeDto;

  @IsDateString()
  periodStart!: string;

  @IsDateString()
  periodEnd!: string;

  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
