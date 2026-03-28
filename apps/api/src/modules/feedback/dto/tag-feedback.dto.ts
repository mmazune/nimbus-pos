import { IsString } from 'class-validator';

export class TagFeedbackDto {
  @IsString()
  tagKey!: string;

  @IsString()
  tagLabel!: string;
}
