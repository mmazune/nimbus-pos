import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class CreateMembershipDto {
  @IsString()
  userId!: string;

  @IsString()
  roleId!: string;

  @IsOptional()
  @IsBoolean()
  isDefaultBranch?: boolean;
}
