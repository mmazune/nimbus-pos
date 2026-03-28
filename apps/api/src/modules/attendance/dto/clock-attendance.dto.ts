import { IsString, IsOptional, MaxLength } from 'class-validator';

export class ClockAttendanceDto {
  @IsString()
  employeeId!: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  notes?: string;
}
