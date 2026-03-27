import { IsOptional, IsString, MaxLength } from 'class-validator';

export class OpenEventDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
