import { IsString } from 'class-validator';

export class ConfirmBattleEntryDto {
  @IsString()
  txHash!: string;
}
