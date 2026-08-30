import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PredictionsService } from '../predictions/predictions.service';
import type { AuthUser } from '../auth/current-user.decorator';

@Injectable()
export class ChallengesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly predictions: PredictionsService,
  ) {}

  async get(id: string) {
    const challenge = await this.prisma.challenge.findUnique({
      where: { id },
      include: {
        originalPrediction: { include: { user: true, market: true } },
        challengerPrediction: { include: { user: true } },
        winner: true,
      },
    });
    if (!challenge) throw new NotFoundException('Challenge not found');
    return {
      id: challenge.id,
      status: challenge.status,
      multiplier: Number(challenge.multiplier),
      energyPaid: challenge.energyPaid.toString(),
      resolvedAt: challenge.resolvedAt?.toISOString() ?? null,
      winnerWallet: challenge.winner?.wallet ?? null,
      market: {
        marketId: challenge.originalPrediction.market.marketId,
        asset: challenge.originalPrediction.market.asset,
      },
      original: {
        id: challenge.originalPrediction.id,
        wallet: challenge.originalPrediction.user.wallet,
        direction: challenge.originalPrediction.direction,
        confidence: Number(challenge.originalPrediction.confidence),
        quantityFilled: challenge.originalPrediction.quantityFilled.toString(),
      },
      challenger: {
        id: challenge.challengerPrediction.id,
        wallet: challenge.challengerPrediction.user.wallet,
        direction: challenge.challengerPrediction.direction,
        confidence: Number(challenge.challengerPrediction.confidence),
        quantityFilled: challenge.challengerPrediction.quantityFilled.toString(),
      },
    };
  }

  async confirmByOriginal(
    user: AuthUser,
    originalPredictionId: string,
    txHash: string,
  ) {
    const pending = await this.prisma.prediction.findFirst({
      where: {
        challengingOfId: originalPredictionId,
        userId: user.userId,
        status: 'PENDING',
      },
    });
    if (!pending) {
      throw new BadRequestException(
        'No pending challenge fill for this prediction',
      );
    }
    return this.predictions.confirm(user, pending.id, txHash);
  }
}
