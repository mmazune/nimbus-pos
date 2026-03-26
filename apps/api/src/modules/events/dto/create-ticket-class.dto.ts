import { IsString, IsOptional, IsInt, IsNumber, IsEnum, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateTicketClassDto {
  @IsString()
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsEnum(['GENERAL', 'VIP', 'TABLE', 'PACKAGE', 'OTHER'])
  type?: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  capacity!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
