import {
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  IsEnum,
  IsDateString,
  IsNotEmpty,
  ArrayMinSize,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';

enum JournalLineDirectionDto {
  DEBIT = 'DEBIT',
  CREDIT = 'CREDIT',
}

export class CreateJournalLineDto {
  @IsString()
  @IsNotEmpty()
  accountId!: string;

  @IsOptional()
  @IsString()
  costCenterId?: string;

  @IsEnum(JournalLineDirectionDto)
  direction!: JournalLineDirectionDto;

  @IsNotEmpty()
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message: 'amount must be a decimal with up to 2 decimal places',
  })
  amount!: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class CreateJournalEntryDto {
  @IsDateString()
  journalDate!: string;

  @IsOptional()
  @IsString()
  sourceKey?: string;

  @IsOptional()
  @IsString()
  sourceDocumentId?: string;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  fiscalPeriodId?: string;

  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => CreateJournalLineDto)
  lines!: CreateJournalLineDto[];
}
