import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateAreaDto {
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name!: string;

  @IsOptional()
  @IsIn(['TABLES', 'TABS'])
  kind?: 'TABLES' | 'TABS';

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(999)
  sortOrder?: number;
}

export class UpdateAreaDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(999)
  sortOrder?: number;
}

export class BulkAddTablesDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  count!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(99999)
  firstNumber!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  seats!: number;
}

export class ChangeSeatsDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  seats!: number;
}

export class OpenTabDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  note?: string;
}

export class TargetTableDto {
  @IsString()
  toTableId!: string;
}

export class JoinTableDto {
  @IsString()
  tableId!: string;
}

export class MoveLineDto {
  @IsString()
  toTableId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity?: number;
}

export class ChangeWaiterDto {
  @IsString()
  toUserId!: string;
}

export class OfferHandoverDto {
  @IsString()
  toUserId!: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @IsString({ each: true })
  tableIds?: string[];

  @IsOptional()
  @IsBoolean()
  all?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;
}

export class ListAreasQueryDto {
  @IsOptional()
  @IsIn(['true', 'false'])
  includePutAway?: 'true' | 'false';
}
