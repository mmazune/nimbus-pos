import { IsString, IsEnum, IsOptional } from 'class-validator';

export enum PromotionDecisionDto {
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  DISMISSED = 'DISMISSED',
}

export class DecidePromotionSuggestionDto {
  @IsEnum(PromotionDecisionDto)
  decision!: PromotionDecisionDto;

  @IsOptional()
  @IsString()
  decisionNotes?: string;
}
