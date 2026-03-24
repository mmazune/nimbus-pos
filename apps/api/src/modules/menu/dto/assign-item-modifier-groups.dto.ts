import { IsArray, IsString, IsOptional, IsInt, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class ModifierGroupAssignment {
  @IsString()
  groupId!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class AssignItemModifierGroupsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ModifierGroupAssignment)
  groups!: ModifierGroupAssignment[];
}
