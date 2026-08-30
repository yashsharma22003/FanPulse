export type RatingInput = {
  winnerRating: number;
  loserRating: number;
  opponentConfidence: number;
  winnerWon: boolean;
};

export type RatingDelta = {
  winnerAfter: number;
  loserAfter: number;
};

export interface RatingCalculator {
  apply(input: RatingInput): RatingDelta;
}
