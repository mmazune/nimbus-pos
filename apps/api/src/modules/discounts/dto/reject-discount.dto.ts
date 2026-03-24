import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RejectDiscountDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  rejectionReason!: string;
}
