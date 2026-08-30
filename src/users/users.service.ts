import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async profile(wallet: string) {
    const user = await this.prisma.user.findUnique({
      where: { wallet: wallet.toLowerCase() },
      include: {
        predictions: {
          include: { market: true, originalChallenge: true, challengerChallenge: true },
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
      },
    });
    if (!user) throw new NotFoundException('User not found');

    const history = user.predictions.map((p) => {
      const challenge = p.originalChallenge ?? p.challengerChallenge;
      return {
        predictionId: p.id,
        marketId: p.market.marketId,
        asset: p.market.asset,
        direction: p.direction,
        confidence: Number(p.confidence),
        quantityFilled: p.quantityFilled.toString(),
        status: p.status,
        challenge: challenge
          ? {
              id: challenge.id,
              status: challenge.status,
              energyPaid: challenge.energyPaid.toString(),
              winnerUserId: challenge.winnerUserId,
            }
          : null,
        createdAt: p.createdAt.toISOString(),
      };
    });

    return {
      wallet: user.wallet,
      challengeEnergy: user.challengeEnergy.toString(),
      challengeRating: user.challengeRating,
      wins: user.wins,
      losses: user.losses,
      history,
    };
  }
}
