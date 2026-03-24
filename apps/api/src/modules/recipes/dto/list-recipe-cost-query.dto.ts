import { IsOptional, IsString } from 'class-validator';

export class ListRecipeCostQueryDto {
  @IsOptional()
  @IsString()
  servingId?: string;
}
