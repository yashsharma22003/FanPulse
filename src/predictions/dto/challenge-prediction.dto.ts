import { Direction } from '@prisma/client';
import { IsEnum, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class ChallengePredictionDto {
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
