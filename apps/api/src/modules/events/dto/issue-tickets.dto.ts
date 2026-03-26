import { IsOptional, IsString, MaxLength } from 'class-validator';

export class IssueTicketsDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  holderName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  holderPhone?: string;
}
