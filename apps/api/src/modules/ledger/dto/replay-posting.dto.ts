import { IsString, IsOptional, IsNotEmpty } from 'class-validator';

export class ReplayPostingDto {
  @IsString()
  @IsNotEmpty()
  sourceKey!: string;

  @IsOptional()
  @IsString()
  sourceDocumentId?: string;
}
