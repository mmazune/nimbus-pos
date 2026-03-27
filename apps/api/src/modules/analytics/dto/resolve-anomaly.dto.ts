import { IsString, MaxLength } from 'class-validator';

export class ResolveAnomalyDto {
  @IsString()
  @MaxLength(2000)
  resolutionNotes!: string;
}
