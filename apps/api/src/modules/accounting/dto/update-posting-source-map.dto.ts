import { IsOptional, IsString, IsBoolean } from 'class-validator';

export class UpdatePostingSourceMapDto {
  @IsOptional()
  @IsString()
  debitAccountId?: string;

  @IsOptional()
  @IsString()
  creditAccountId?: string;

  @IsOptional()
  @IsBoolean()
  costCenterRequired?: boolean;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;
}
