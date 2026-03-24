import { IsString, IsOptional } from 'class-validator';

export class AssignMenuItemBrowseDto {
  @IsOptional()
  @IsString()
  browseGroupId?: string | null;

  @IsOptional()
  @IsString()
  browseSubgroupId?: string | null;
}
