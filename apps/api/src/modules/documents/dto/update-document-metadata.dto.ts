import { IsOptional, IsObject } from 'class-validator';

export class UpdateDocumentMetadataDto {
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
