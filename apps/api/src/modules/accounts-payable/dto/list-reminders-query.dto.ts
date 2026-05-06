import { IsString, IsOptional, IsEnum, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

export enum PayableReminderStatusDto {
  PENDING = 'PENDING',
  DISMISSED = 'DISMISSED',
  AUTO_RESOLVED = 'AUTO_RESOLVED',
}

export class ListRemindersQueryDto {
  @IsOptional()
  @IsString()
  supplierId?: string;

  @IsOptional()
  @IsEnum(PayableReminderStatusDto)
  status?: PayableReminderStatusDto;

  @IsOptional()
  @IsDateString()
  dueBefore?: string;

  @IsOptional()
  @Type(() => Number)
  skip?: number;

  @IsOptional()
  @Type(() => Number)
  take?: number;
}
