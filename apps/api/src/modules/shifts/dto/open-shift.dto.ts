import { IsOptional, IsString, MaxLength } from 'class-validator';

export class OpenShiftDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
