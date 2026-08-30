import { Injectable, Logger } from '@nestjs/common';
import {
  ChallengeStatus,
  Direction,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DreamdexService } from '../dreamdex/dreamdex.service';
import { EnergyService } from './energy.service';
import { EloRatingCalculator } from './elo-rating.calculator';
import type { RatingCalculator } from './rating-calculator';

@Injectable()
export class SettlementService {
  private readonly logger = new Logger(SettlementService.name);
  private readonly rating: RatingCalculator;

  constructor(
    private readonly prisma: PrismaService,
    private readonly dreamdex: DreamdexService,
    private readonly energy: EnergyService,
    elo: EloRatingCalculator,
  ) {
    this.rating = elo;
  }

  async resolveLockedChallenges() {
    const locked = await this.prisma.challenge.findMany({
      where: { status: ChallengeStatus.LOCKED },
      include: {
        originalPrediction: { include: { user: true, market: true } },
        challengerPrediction: { include: { user: true } },
      },
    });

    for (const challenge of locked) {
      try {
        await this.resolveOne(challenge);
      } catch (err) {
        this.logger.warn(
          `Resolve ${challenge.id} failed: ${(err as Error).message}`,
        );
      }
    }
  }

  async expireOpenPredictions() {
    const now = new Date();
    await this.prisma.prediction.updateMany({
      where: {
        status: 'OPEN',
        challengeExpiresAt: { lte: now },
        originalChallenge: { is: null },
      },
      data: { status: 'EXPIRED' },
    });
  }

  private async resolveOne(challenge: {
    id: string;
    originalPrediction: {
      id: string;
      direction: Direction;
      confidence: Prisma.Decimal;
      quantityFilled: Prisma.Decimal;
      userId: string;
      user: { id: string; challengeRating: number };
      market: { marketId: string };
    };
    challengerPrediction: {
      id: string;
      direction: Direction;
      confidence: Prisma.Decimal;
      quantityFilled: Prisma.Decimal;
      userId: string;
      user: { id: string; challengeRating: number };
    };
  }) {
    const onchain = await this.dreamdex.getMarketOnchain(
      challenge.originalPrediction.market.marketId,
    );

    if (onchain.isVoided) {
      await this.prisma.challenge.update({
        where: { id: challenge.id },
        data: {
          status: ChallengeStatus.VOIDED,
          resolvedAt: new Date(),
        },
      });
      this.logger.log(`Challenge ${challenge.id} voided (no energy)`);
      return;
    }

    if (!onchain.isResolved) {
      return;
    }

    const winningDirection =
      onchain.winningOutcome === 0 ? Direction.UP : Direction.DOWN;
    const originalWon =
      challenge.originalPrediction.direction === winningDirection;
    const winner = originalWon
      ? challenge.originalPrediction
      : challenge.challengerPrediction;
    const loser = originalWon
      ? challenge.challengerPrediction
      : challenge.originalPrediction;

    const opponentConfidence = Number(loser.confidence);
    const { multiplier, energy } = this.energy.payout(
      winner.quantityFilled,
      opponentConfidence,
    );
    const deltas = this.rating.apply({
      winnerRating: winner.user.challengeRating,
      loserRating: loser.user.challengeRating,
      opponentConfidence,
      winnerWon: true,
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.challenge.update({
        where: { id: challenge.id },
        data: {
          status: ChallengeStatus.RESOLVED,
          winnerUserId: winner.userId,
          multiplier: new Prisma.Decimal(multiplier.toFixed(4)),
          energyPaid: energy,
          resolvedAt: new Date(),
        },
      });
      await tx.user.update({
        where: { id: winner.userId },
        data: {
          challengeEnergy: { increment: energy },
          challengeRating: deltas.winnerAfter,
          wins: { increment: 1 },
        },
      });
      await tx.user.update({
        where: { id: loser.userId },
        data: {
          challengeRating: deltas.loserAfter,
          losses: { increment: 1 },
        },
      });
      await tx.ratingEvent.createMany({
        data: [
          {
            userId: winner.userId,
            challengeId: challenge.id,
            ratingBefore: winner.user.challengeRating,
            ratingAfter: deltas.winnerAfter,
            input: {
              role: 'winner',
              opponentConfidence,
              opponentRating: loser.user.challengeRating,
            },
          },
          {
            userId: loser.userId,
            challengeId: challenge.id,
            ratingBefore: loser.user.challengeRating,
            ratingAfter: deltas.loserAfter,
            input: {
              role: 'loser',
              opponentConfidence: Number(winner.confidence),
              opponentRating: winner.user.challengeRating,
            },
          },
        ],
      });
    });

    this.logger.log(
      `Challenge ${challenge.id} resolved: winner=${winner.userId} energy=${energy.toString()}`,
    );
  }
}
