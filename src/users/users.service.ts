import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FanNftService } from '../nft/fan-nft.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fanNft: FanNftService,
  ) {}

  async profile(wallet: string) {
    const user = await this.prisma.user.findUnique({
      where: { wallet: wallet.toLowerCase() },
      include: {
        predictions: {
          include: { market: true, originalChallenge: true, challengerChallenge: true },
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
        battleEntries: {
          include: {
            battle: { include: { market: true } },
            prediction: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
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

    const fanNft = this.fanNft.profileFanNft(user);
    const tokenURI = await this.fanNft.tokenURI(user.fanNftTokenId);

    const battleHistory = user.battleEntries.map((e) => ({
      battleId: e.battleId,
      marketId: e.battle.market.marketId,
      asset: e.battle.market.asset,
      battleStatus: e.battle.status,
      direction: e.prediction.direction,
      confidence: Number(e.prediction.confidence),
      placement: e.placement,
      energyPaid: e.energyPaid.toString(),
      winningDirection: e.battle.winningDirection,
      resolvedAt: e.battle.resolvedAt?.toISOString() ?? null,
      createdAt: e.createdAt.toISOString(),
    }));

    return {
      wallet: user.wallet,
      challengeEnergy: user.challengeEnergy.toString(),
      challengeRating: user.challengeRating,
      wins: user.wins,
      losses: user.losses,
      battlesWon: user.battlesWon,
      history,
      battleHistory,
      fanNft: {
        ...fanNft,
        tokenURI,
      },
    };
  }
}
