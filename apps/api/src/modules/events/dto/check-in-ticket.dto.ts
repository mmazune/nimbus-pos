import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CheckInTicketDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  message?: string;
}
