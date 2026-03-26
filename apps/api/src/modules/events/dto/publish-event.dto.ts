import { IsOptional, IsString, MaxLength } from 'class-validator';

export class PublishEventDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  slug?: string;
}
