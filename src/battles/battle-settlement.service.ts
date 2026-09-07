import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BattleStatus,
  Direction,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DreamdexService } from '../dreamdex/dreamdex.service';
import { EnergyService } from '../rewards/energy.service';
import { BattleRatingCalculator } from './battle-rating.calculator';

type EntryRow = {
  id: string;
  userId: string;
  prediction: {
    id: string;
    direction: Direction;
    confidence: Prisma.Decimal;
    quantityFilled: Prisma.Decimal;
    user: { id: string; challengeRating: number };
  };
};

@Injectable()
export class BattleSettlementService {
  private readonly logger = new Logger(BattleSettlementService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly dreamdex: DreamdexService,
    private readonly energy: EnergyService,
    private readonly rating: BattleRatingCalculator,
    private readonly config: ConfigService,
  ) {}

  async lockOpenBattles() {
    const now = new Date();
    const open = await this.prisma.battle.findMany({
      where: { status: BattleStatus.OPEN },
      include: { market: true, entries: true },
    });

    for (const battle of open) {
      let shouldLock = battle.locksAt <= now;
      if (!shouldLock) {
        try {
          await this.dreamdex.assertTradable(
            battle.market.marketId,
            this.config.getOrThrow<number>('minTradingHeadroomSec'),
          );
        } catch {
          shouldLock = true;
        }
      }
      if (!shouldLock) continue;

      const minEntrants = this.config.getOrThrow<number>('battleMinEntrants');
      if (battle.entries.length < minEntrants) {
        await this.prisma.battle.update({
          where: { id: battle.id },
          data: {
            status: BattleStatus.VOIDED,
            voidReason: 'insufficient_entrants',
            resolvedAt: new Date(),
          },
        });
        this.logger.log(
          `Battle ${battle.id} voided: insufficient entrants (${battle.entries.length})`,
        );
        continue;
      }

      await this.prisma.battle.update({
        where: { id: battle.id },
        data: { status: BattleStatus.LOCKED },
      });
      this.logger.log(`Battle ${battle.id} locked (${battle.entries.length} entrants)`);
    }
  }

  async resolveLockedBattles() {
    const locked = await this.prisma.battle.findMany({
      where: { status: BattleStatus.LOCKED },
      include: {
        market: true,
        entries: {
          include: {
            prediction: { include: { user: true } },
          },
        },
      },
    });

    for (const battle of locked) {
      try {
        await this.resolveOne(battle);
      } catch (err) {
        this.logger.warn(
          `Battle resolve ${battle.id} failed: ${(err as Error).message}`,
        );
      }
    }
  }

  private async resolveOne(battle: {
    id: string;
    entries: EntryRow[];
    market: { marketId: string };
  }) {
    const onchain = await this.dreamdex.getMarketOnchain(battle.market.marketId);

    if (onchain.isVoided) {
      await this.prisma.battle.update({
        where: { id: battle.id },
        data: {
          status: BattleStatus.VOIDED,
          voidReason: 'dreamdex_void',
          resolvedAt: new Date(),
        },
      });
      this.logger.log(`Battle ${battle.id} voided (DreamDEX void)`);
      return;
    }

    if (!onchain.isResolved) return;

    const winningDirection =
      onchain.winningOutcome === 0 ? Direction.UP : Direction.DOWN;

    const correct = battle.entries
      .filter((e) => e.prediction.direction === winningDirection)
      .sort((a, b) => {
        const confDiff =
          Number(b.prediction.confidence) - Number(a.prediction.confidence);
        if (confDiff !== 0) return confDiff;
        return a.id.localeCompare(b.id);
      });

    const wrong = battle.entries.filter(
      (e) => e.prediction.direction !== winningDirection,
    );

    const placementByEntryId = new Map<string, number>();
    correct.forEach((e, i) => placementByEntryId.set(e.id, i + 1));

    const avgWrongConfidence =
      wrong.length > 0
        ? wrong.reduce((s, e) => s + Number(e.prediction.confidence), 0) /
          wrong.length
        : 0.5;
    const convictionBonus = this.energy.multiplier(avgWrongConfidence);

    const ratings = battle.entries.map((e) => e.prediction.user.challengeRating);
    const fieldAverage =
      ratings.length > 0
        ? ratings.reduce((a, b) => a + b, 0) / ratings.length
        : 1000;

    await this.prisma.$transaction(async (tx) => {
      for (const entry of battle.entries) {
        const placement = placementByEntryId.get(entry.id) ?? null;
        const isCorrect = placement !== null;
        const userConfidence = Number(entry.prediction.confidence);
        const others = battle.entries.filter((e) => e.userId !== entry.userId);
        const fieldRating =
          others.length > 0
            ? others.reduce(
                (s, e) => s + e.prediction.user.challengeRating,
                0,
              ) / others.length
            : fieldAverage;

        let energyPaid = new Prisma.Decimal(0);
        let multiplier = new Prisma.Decimal(1);

        if (isCorrect && placement) {
          const placementWeight = 1 / placement;
          const base = Number(entry.prediction.quantityFilled);
          energyPaid = new Prisma.Decimal(
            (base * placementWeight * convictionBonus).toFixed(8),
          );
          multiplier = new Prisma.Decimal(convictionBonus.toFixed(4));
        }

        const delta = this.rating.apply({
          userRating: entry.prediction.user.challengeRating,
          userConfidence,
          fieldRating,
          placement: placement ?? null,
          isCorrect,
        });

        await tx.battleEntry.update({
          where: { id: entry.id },
          data: {
            placement,
            energyPaid,
            multiplier,
          },
        });

        await tx.user.update({
          where: { id: entry.userId },
          data: {
            challengeEnergy: { increment: energyPaid },
            challengeRating: delta.ratingAfter,
            wins: { increment: delta.winsDelta },
            losses: { increment: delta.lossesDelta },
            battlesWon: { increment: delta.battlesWonDelta },
            fanNftSyncPending: true,
          },
        });

        await tx.battleRatingEvent.create({
          data: {
            battleId: battle.id,
            userId: entry.userId,
            ratingBefore: entry.prediction.user.challengeRating,
            ratingAfter: delta.ratingAfter,
            input: {
              placement,
              isCorrect,
              fieldRating,
              avgWrongConfidence,
              convictionBonus,
              energyPaid: energyPaid.toString(),
            },
          },
        });
      }

      await tx.battle.update({
        where: { id: battle.id },
        data: {
          status: BattleStatus.RESOLVED,
          winningDirection,
          resolvedAt: new Date(),
        },
      });
    });

    this.logger.log(
      `Battle ${battle.id} resolved: ${correct.length} correct, ${wrong.length} wrong`,
    );
  }
}
