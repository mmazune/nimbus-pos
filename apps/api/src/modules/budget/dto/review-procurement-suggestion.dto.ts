import { IsString, IsOptional, IsEnum, MaxLength } from 'class-validator';

export enum ReviewStatusDto {
  REVIEWED = 'REVIEWED',
  DISMISSED = 'DISMISSED',
  ACTIONED = 'ACTIONED',
}

export class ReviewProcurementSuggestionDto {
  @IsEnum(ReviewStatusDto)
  status!: ReviewStatusDto;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reviewNotes?: string;
}
