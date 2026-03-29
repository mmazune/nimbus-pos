import { IsString, IsNotEmpty, IsDateString, MaxLength } from 'class-validator';

export class CreateFiscalPeriodDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @IsDateString()
  startsAt!: string;

  @IsDateString()
  endsAt!: string;
}
