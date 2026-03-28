import { IsEnum, IsOptional, IsString, IsObject } from 'class-validator';
import { DocumentType } from '@prisma/client';

export class UploadDocumentDto {
  @IsEnum(DocumentType)
  documentType!: DocumentType;

  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
