import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ApproveDiscountDto {
  @IsOptional()
  @IsString()
  @MaxLength(8)
  managerPin?: string;
}
