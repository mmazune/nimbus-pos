import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ApprovePayRunDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
