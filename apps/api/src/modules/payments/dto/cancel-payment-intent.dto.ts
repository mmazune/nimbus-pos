import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CancelPaymentIntentDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
