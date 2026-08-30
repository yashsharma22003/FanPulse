import { IsString } from 'class-validator';

export class LoginDto {
  @IsString()
  message!: string;

  @IsString()
  signature!: string;
}
