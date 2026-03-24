import { IsOptional, IsString } from 'class-validator';

export class ListInventoryLevelsQueryDto {
  @IsOptional()
  @IsString()
  category?: string;
}
