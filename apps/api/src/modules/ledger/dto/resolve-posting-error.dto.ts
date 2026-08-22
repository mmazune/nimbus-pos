import { IsOptional, IsString } from 'class-validator';

export class ResolvePostingErrorDto {
  @IsOptional()
  @IsString()
  resolutionNotes?: string;
}
