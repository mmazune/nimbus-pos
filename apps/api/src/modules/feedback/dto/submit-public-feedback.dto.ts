import { IsString, IsOptional, IsInt, Min, Max } from 'class-validator';

export class SubmitPublicFeedbackDto {
  @IsString()
  token!: string;

  @IsOptional()
  @IsString()
  customerName?: string;

  @IsOptional()
  @IsString()
  customerPhone?: string;

  @IsOptional()
  @IsString()
  customerEmail?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10)
  npsScore?: number;

  @IsOptional()
  @IsString()
  comment?: string;
}
