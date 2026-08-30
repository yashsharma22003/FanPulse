import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

@Injectable()
export class EnergyService {
  multiplier(opponentConfidence: number): number {
    if (opponentConfidence > 0.5) {
      return Math.min(2, 1 + 2 * (opponentConfidence - 0.5));
    }
    return 1;
  }

  payout(stake: Prisma.Decimal | number | string, opponentConfidence: number) {
    const m = this.multiplier(opponentConfidence);
    const s = Number(stake);
    const energy = s * m;
    return {
      multiplier: m,
      energy: new Prisma.Decimal(energy.toFixed(8)),
    };
  }
}
