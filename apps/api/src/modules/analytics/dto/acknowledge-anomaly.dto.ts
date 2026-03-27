import { IsString, IsOptional, MaxLength } from 'class-validator';

export class AcknowledgeAnomalyDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  resolutionNotes?: string;
}
