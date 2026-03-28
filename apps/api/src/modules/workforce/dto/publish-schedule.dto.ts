import { IsOptional, IsString, MaxLength } from 'class-validator';

export class PublishScheduleDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
