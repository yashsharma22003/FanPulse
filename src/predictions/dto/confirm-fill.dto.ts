import { IsString } from 'class-validator';

export class ConfirmFillDto {
  @IsString()
  txHash!: string;
}
