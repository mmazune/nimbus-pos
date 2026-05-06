import { IsString, IsOptional } from 'class-validator';

export class SkipLineDto {
  @IsString()
  bankStatementLineId!: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
