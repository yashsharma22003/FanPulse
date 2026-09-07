import { Injectable } from '@nestjs/common';

export type BattleRatingInput = {
  userRating: number;
  userConfidence: number;
  fieldRating: number;
  placement: number | null;
  isCorrect: boolean;
};

export type BattleRatingDelta = {
  ratingAfter: number;
  winsDelta: number;
  lossesDelta: number;
  battlesWonDelta: number;
};

@Injectable()
export class BattleRatingCalculator {
  apply(input: BattleRatingInput): BattleRatingDelta {
    const k = 32 * (0.5 + input.userConfidence);
    const expected =
      1 / (1 + 10 ** ((input.fieldRating - input.userRating) / 400));

    if (!input.isCorrect) {
      return {
        ratingAfter: Math.round(input.userRating + k * (0 - expected)),
        winsDelta: 0,
        lossesDelta: 1,
        battlesWonDelta: 0,
      };
    }

    if (input.placement === 1) {
      return {
        ratingAfter: Math.round(input.userRating + k * (1 - expected)),
        winsDelta: 1,
        lossesDelta: 0,
        battlesWonDelta: 1,
      };
    }

    return {
      ratingAfter: Math.round(
        input.userRating + k * 0.25 * (1 - expected),
      ),
      winsDelta: 1,
      lossesDelta: 0,
      battlesWonDelta: 0,
    };
  }
}
