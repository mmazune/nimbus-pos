import { IsEnum, IsOptional, IsString, IsObject } from 'class-validator';
import { DocumentLinkType } from '@prisma/client';

export class LinkDocumentDto {
  @IsEnum(DocumentLinkType)
  linkType!: DocumentLinkType;

  @IsString()
  linkedRecordId!: string;

  @IsOptional()
  @IsString()
  linkedRecordLabel?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
