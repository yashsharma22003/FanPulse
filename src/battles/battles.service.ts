import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BattleStatus,
  Direction,
  PredictionStatus,
  Prisma,
} from '@prisma/client';
import { getAddress, type Address, type Hex } from 'viem';
import { PrismaService } from '../prisma/prisma.service';
import { DreamdexService } from '../dreamdex/dreamdex.service';
import { MarketsService } from '../markets/markets.service';
import { PredictionsService } from '../predictions/predictions.service';
import type { AuthUser } from '../auth/current-user.decorator';
import type { EnterBattleDto } from './dto/enter-battle.dto';

@Injectable()
export class BattlesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dreamdex: DreamdexService,
    private readonly markets: MarketsService,
    private readonly predictions: PredictionsService,
    private readonly config: ConfigService,
  ) {}

  async enter(user: AuthUser, dto: EnterBattleDto) {
    const confidence = this.predictions.normalizeConfidence(dto.confidence);
    const quantity = dto.quantity ?? 1;
    const minHeadroom = this.config.getOrThrow<number>('minTradingHeadroomSec');

    try {
      await this.dreamdex.assertTradable(dto.marketId, minHeadroom);
    } catch (err) {
      throw new BadRequestException((err as Error).message);
    }

    const indexed = await this.dreamdex.getBinaryMarket(dto.marketId);
    if (!indexed) throw new NotFoundException('Market not found');
    const market = await this.markets.upsertFromIndexed(indexed);

    const battle = await this.findOrCreateBattle(market.id, market.expiry);
    if (battle.status !== BattleStatus.OPEN) {
      throw new BadRequestException('Battle is not open for entries');
    }
    if (battle.locksAt.getTime() <= Date.now()) {
      throw new BadRequestException('Battle entry window has closed');
    }

    const existing = await this.prisma.battleEntry.findUnique({
      where: { battleId_userId: { battleId: battle.id, userId: user.userId } },
    });
    if (existing) {
      throw new ConflictException('You have already entered this battle');
    }

    const pendingBattle = await this.prisma.prediction.findFirst({
      where: {
        userId: user.userId,
        battleId: battle.id,
        status: PredictionStatus.PENDING,
      },
    });
    if (pendingBattle) {
      throw new ConflictException({
        message: 'You have a pending battle entry to confirm',
        predictionId: pendingBattle.id,
      });
    }

    const prepared = await this.dreamdex
      .prepareBuy({
        marketId: indexed.marketId,
        direction: dto.direction,
        quantityHuman: quantity,
      })
      .catch((err: Error) => {
        throw new BadRequestException(err.message);
      });

    const prediction = await this.prisma.prediction.create({
      data: {
        userId: user.userId,
        marketRowId: market.id,
        direction: dto.direction,
        confidence,
        quantity: new Prisma.Decimal(prepared.quantityHuman),
        yesId: prepared.yesId,
        noId: prepared.noId,
        status: PredictionStatus.PENDING,
        battleId: battle.id,
      },
    });

    const entrantCount = await this.prisma.battleEntry.count({
      where: { battleId: battle.id },
    });

    return {
      battle: this.serializeBattle(battle, entrantCount),
      prediction: this.predictions.serialize(prediction),
      order: prepared,
    };
  }

  async confirmEntry(user: AuthUser, predictionId: string, txHash: string) {
    const prediction = await this.prisma.prediction.findUnique({
      where: { id: predictionId },
      include: { market: true, battle: true, battleEntry: true },
    });
    if (!prediction) throw new NotFoundException('Prediction not found');
    if (prediction.userId !== user.userId) {
      throw new ForbiddenException('Not your prediction');
    }
    if (!prediction.battleId || !prediction.battle) {
      throw new BadRequestException('Not a battle entry');
    }
    if (prediction.battleEntry) {
      throw new BadRequestException('Battle entry already confirmed');
    }
    if (prediction.status !== PredictionStatus.PENDING) {
      throw new BadRequestException('Prediction is not pending confirmation');
    }
    if (prediction.battle.status !== BattleStatus.OPEN) {
      throw new BadRequestException('Battle is no longer open');
    }

    const kind = this.dreamdex.kindForDirection(prediction.direction);
    const proof = await this.dreamdex.verifyFill({
      txHash: txHash as Hex,
      wallet: getAddress(user.wallet) as Address,
      marketId: prediction.market.marketId,
      expectedKind: kind,
      pool: prediction.market.pool as Address,
    });

    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.prediction.update({
        where: { id: prediction.id },
        data: {
          status: PredictionStatus.LOCKED,
          txHash,
          orderId: proof.orderId,
          quantityFilled: new Prisma.Decimal(proof.quantityFilled),
        },
      });
      const entry = await tx.battleEntry.create({
        data: {
          battleId: prediction.battleId!,
          userId: user.userId,
          predictionId: prediction.id,
        },
      });
      return { updated, entry };
    });

    const entrantCount = await this.prisma.battleEntry.count({
      where: { battleId: prediction.battleId },
    });

    return {
      prediction: this.predictions.serialize(result.updated),
      battleEntry: { id: result.entry.id, battleId: result.entry.battleId },
      battle: this.serializeBattle(prediction.battle, entrantCount),
    };
  }

  async abandonPendingEntry(user: AuthUser, predictionId: string) {
    const prediction = await this.prisma.prediction.findUnique({
      where: { id: predictionId },
    });
    if (!prediction) throw new NotFoundException('Prediction not found');
    if (prediction.userId !== user.userId) {
      throw new ForbiddenException('Not your prediction');
    }
    if (!prediction.battleId) {
      throw new BadRequestException('Not a battle entry');
    }
    if (prediction.status !== PredictionStatus.PENDING) {
      throw new BadRequestException('Only pending entries can be abandoned');
    }

    await this.prisma.prediction.delete({ where: { id: predictionId } });
    return { ok: true, predictionId };
  }

  async getById(id: string, wallet?: string) {
    const battle = await this.prisma.battle.findUnique({
      where: { id },
      include: {
        market: true,
        entries: {
          include: {
            prediction: { include: { user: true } },
            user: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!battle) throw new NotFoundException('Battle not found');
    return this.serializeDetail(battle, wallet);
  }

  async getByMarketId(marketId: string, wallet?: string) {
    const market = await this.prisma.market.findUnique({
      where: { marketId: marketId.toLowerCase() },
    });
    if (!market) throw new NotFoundException('Market not found');
    const battle = await this.prisma.battle.findUnique({
      where: { marketRowId: market.id },
      include: {
        market: true,
        entries: {
          include: {
            prediction: { include: { user: true } },
            user: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!battle) throw new NotFoundException('No battle for this market');
    return this.serializeDetail(battle, wallet);
  }

  async list(params: {
    status?: BattleStatus;
    marketId?: string;
    limit?: number;
  }) {
    const limit = Math.min(params.limit ?? 50, 100);
    const where: Prisma.BattleWhereInput = {};
    if (params.status) where.status = params.status;
    if (params.marketId) {
      where.market = { marketId: params.marketId.toLowerCase() };
    }

    const rows = await this.prisma.battle.findMany({
      where,
      include: {
        market: true,
        _count: { select: { entries: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return rows.map((b) => ({
      ...this.serializeBattle(b, b._count.entries),
      marketId: b.market.marketId,
      asset: b.market.asset,
    }));
  }

  private async findOrCreateBattle(marketRowId: string, expiry: Date) {
    const existing = await this.prisma.battle.findUnique({
      where: { marketRowId },
    });
    if (existing) return existing;

    const minHeadroom = this.config.getOrThrow<number>('minTradingHeadroomSec');
    const locksAt = new Date(expiry.getTime() - minHeadroom * 1000);

    return this.prisma.battle.create({
      data: {
        marketRowId,
        locksAt,
        status: BattleStatus.OPEN,
      },
    });
  }

  private serializeBattle(
    battle: {
      id: string;
      status: BattleStatus;
      locksAt: Date;
      winningDirection?: Direction | null;
      voidReason?: string | null;
      resolvedAt?: Date | null;
    },
    entrantCount: number,
  ) {
    const secondsLeft = Math.max(
      0,
      Math.floor((battle.locksAt.getTime() - Date.now()) / 1000),
    );
    return {
      id: battle.id,
      status: battle.status,
      locksAt: battle.locksAt.toISOString(),
      secondsLeft,
      entrantCount,
      winningDirection: battle.winningDirection ?? null,
      voidReason: battle.voidReason ?? null,
      resolvedAt: battle.resolvedAt?.toISOString() ?? null,
    };
  }

  private async serializeDetail(
    battle: {
      id: string;
      status: BattleStatus;
      locksAt: Date;
      winningDirection: Direction | null;
      voidReason: string | null;
      resolvedAt: Date | null;
      market: {
        id: string;
        marketId: string;
        asset: string;
        intervalSec: number;
        aiProbability: number | null;
      };
      entries: Array<{
        id: string;
        placement: number | null;
        energyPaid: Prisma.Decimal;
        user: { wallet: string };
        prediction: {
          direction: Direction;
          confidence: Prisma.Decimal;
        };
      }>;
    },
    wallet?: string,
  ) {
    const battleUpPercent = this.battleUpPercent(battle.entries);
    const marketUpPercent = await this.markets.communityUpPercent(
      battle.market.id,
    );
    const walletLower = wallet?.toLowerCase();

    const entries = battle.entries.map((e) => ({
      wallet: e.user.wallet,
      direction: e.prediction.direction,
      confidencePercent: Math.round(Number(e.prediction.confidence) * 100),
      placement: e.placement ?? undefined,
      energyPaid:
        battle.status === BattleStatus.RESOLVED
          ? e.energyPaid.toString()
          : undefined,
      isYou: walletLower ? e.user.wallet === walletLower : undefined,
    }));

    return {
      ...this.serializeBattle(battle, battle.entries.length),
      marketId: battle.market.marketId,
      asset: battle.market.asset,
      intervalSec: battle.market.intervalSec,
      aiPercent: battle.market.aiProbability,
      battleUpPercent,
      marketUpPercent,
      entries,
    };
  }

  private battleUpPercent(
    entries: Array<{ prediction: { direction: Direction; confidence: Prisma.Decimal } }>,
  ): number | null {
    if (entries.length === 0) return null;
    const sum = entries.reduce(
      (acc, e) =>
        acc +
        this.markets.statedAsUpPercent(
          e.prediction.direction,
          Number(e.prediction.confidence),
        ),
      0,
    );
    return Math.round((sum / entries.length) * 10) / 10;
  }
}
