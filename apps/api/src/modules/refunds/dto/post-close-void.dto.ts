import { IsString, MaxLength } from 'class-validator';

export class PostCloseVoidDto {
  @IsString()
  @MaxLength(500)
  reason!: string;

  @IsString()
  managerPin!: string;
}
