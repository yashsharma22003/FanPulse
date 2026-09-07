import { Direction } from '@prisma/client';
import { IsEnum, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

/** Internal shape after merging route param + request body. */
export class EnterBattleDto {
  @IsString()
  marketId!: string;

  @IsEnum(Direction)
  direction!: Direction;

  @IsNumber()
  @Min(1)
  @Max(99)
  confidence!: number;

  @IsOptional()
  @IsNumber()
  @Min(0.0001)
  quantity?: number;
}
