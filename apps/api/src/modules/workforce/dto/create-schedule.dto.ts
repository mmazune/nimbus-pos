import {
  IsString,
  IsOptional,
  IsDateString,
  IsArray,
  ValidateNested,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ScheduleAssignmentInput {
  @IsString()
  shiftTemplateId!: string;

  @IsString()
  employeeId!: string;

  @IsDateString()
  shiftDate!: string;

  @IsOptional()
  @IsString()
  roleKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class CreateScheduleDto {
  @IsString()
  @MaxLength(200)
  name!: string;

  @IsDateString()
  dateFrom!: string;

  @IsDateString()
  dateTo!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScheduleAssignmentInput)
  assignments?: ScheduleAssignmentInput[];
}
