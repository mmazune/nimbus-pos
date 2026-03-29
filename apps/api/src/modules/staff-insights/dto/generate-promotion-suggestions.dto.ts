import { IsString, IsDateString, IsOptional, IsArray } from 'class-validator';

export class GeneratePromotionSuggestionsDto {
  @IsDateString()
  periodStart!: string;

  @IsDateString()
  periodEnd!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  employeeIds?: string[];

  @IsOptional()
  @IsString()
  suggestedPositionId?: string;
}
