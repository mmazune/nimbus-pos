import { IsOptional, IsString } from 'class-validator';

export class DismissPostingErrorDto {
  @IsOptional()
  @IsString()
  resolutionNotes?: string;
}
