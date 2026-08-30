import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LeaderboardService {
  constructor(private readonly prisma: PrismaService) {}

  async list(sort: 'energy' | 'rating' = 'energy') {
    const orderBy =
      sort === 'rating'
        ? { challengeRating: 'desc' as const }
        : { challengeEnergy: 'desc' as const };
    const users = await this.prisma.user.findMany({
      orderBy,
      take: 100,
      select: {
        wallet: true,
        challengeEnergy: true,
        challengeRating: true,
        wins: true,
        losses: true,
      },
    });
    return users.map((u, i) => ({
      rank: i + 1,
      wallet: u.wallet,
      challengeEnergy: u.challengeEnergy.toString(),
      challengeRating: u.challengeRating,
      wins: u.wins,
      losses: u.losses,
    }));
  }
}
