import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CloseEventDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
