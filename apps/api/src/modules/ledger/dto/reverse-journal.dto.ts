import { IsOptional, IsString } from 'class-validator';

export class ReverseJournalDto {
  @IsOptional()
  @IsString()
  reason?: string;
}
