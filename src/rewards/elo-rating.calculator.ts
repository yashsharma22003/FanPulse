import { Injectable } from '@nestjs/common';
import type { RatingCalculator, RatingDelta, RatingInput } from './rating-calculator';

@Injectable()
export class EloRatingCalculator implements RatingCalculator {
  apply(input: RatingInput): RatingDelta {
    const k = 32 * (0.5 + input.opponentConfidence);
    const expectedWinner =
      1 / (1 + 10 ** ((input.loserRating - input.winnerRating) / 400));
    const expectedLoser = 1 - expectedWinner;
    const winnerAfter = Math.round(
      input.winnerRating + k * (1 - expectedWinner),
    );
    const loserAfter = Math.round(input.loserRating + k * (0 - expectedLoser));
    return { winnerAfter, loserAfter };
  }
}
