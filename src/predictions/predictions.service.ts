import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Direction,
  PredictionStatus,
  Prisma,
} from '@prisma/client';
import { getAddress, type Address, type Hex } from 'viem';
import { PrismaService } from '../prisma/prisma.service';
import { DreamdexService } from '../dreamdex/dreamdex.service';
import { MarketsService } from '../markets/markets.service';
import type { AuthUser } from '../auth/current-user.decorator';
import type { CreatePredictionDto } from './dto/create-prediction.dto';
import type { ChallengePredictionDto } from './dto/challenge-prediction.dto';

@Injectable()
export class PredictionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dreamdex: DreamdexService,
    private readonly markets: MarketsService,
    private readonly config: ConfigService,
  ) {}

  async create(user: AuthUser, dto: CreatePredictionDto) {
    const confidence = this.normalizeConfidence(dto.confidence);
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
    const prepared = await this.dreamdex.prepareBuy({
      marketId: indexed.marketId,
      direction: dto.direction,
      quantityHuman: quantity,
    }).catch((err: Error) => {
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
      },
    });

    return {
      prediction: this.serialize(prediction),
      order: prepared,
    };
  }

  async confirm(user: AuthUser, predictionId: string, txHash: string) {
    const prediction = await this.prisma.prediction.findUnique({
      where: { id: predictionId },
      include: { market: true, user: true },
    });
    if (!prediction) throw new NotFoundException('Prediction not found');
    if (prediction.userId !== user.userId) {
      throw new ForbiddenException('Not your prediction');
    }
    if (prediction.battleId) {
      throw new BadRequestException(
        'Use POST /battles/entries/:predictionId/confirm for battle entries',
      );
    }
    if (prediction.status !== PredictionStatus.PENDING) {
      throw new BadRequestException('Prediction is not pending confirmation');
    }

    const kind = this.dreamdex.kindForDirection(prediction.direction);
    const proof = await this.dreamdex.verifyFill({
      txHash: txHash as Hex,
      wallet: getAddress(user.wallet) as Address,
      marketId: prediction.market.marketId,
      expectedKind: kind,
      pool: prediction.market.pool as Address,
    });

    if (prediction.challengingOfId) {
      return this.confirmChallenge(prediction, proof, txHash);
    }

    const windowMs = this.config.getOrThrow<number>('challengeWindowMs');
    const minHeadroom = this.config.getOrThrow<number>('minTradingHeadroomSec');
    const onchain = await this.dreamdex.getMarketOnchain(
      prediction.market.marketId,
    );
    const leftMs = this.dreamdex.secondsLeft(onchain.expiry) * 1000;
    const challengeMs = Math.min(windowMs, Math.max(0, leftMs - minHeadroom * 1000));
    const challengeExpiresAt = new Date(Date.now() + challengeMs);

    const updated = await this.prisma.prediction.update({
      where: { id: prediction.id },
      data: {
        status: PredictionStatus.OPEN,
        txHash,
        orderId: proof.orderId,
        quantityFilled: new Prisma.Decimal(proof.quantityFilled),
        challengeExpiresAt,
      },
    });
    return { prediction: this.serialize(updated) };
  }

  async listOpen() {
    const now = new Date();
    const rows = await this.prisma.prediction.findMany({
      where: {
        status: PredictionStatus.OPEN,
        challengeExpiresAt: { gt: now },
        originalChallenge: null,
        battleId: null,
        battleEntry: null,
      },
      include: { user: true, market: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return rows.map((p) => this.serializeOpen(p));
  }

  async challenge(
    user: AuthUser,
    originalId: string,
    dto: ChallengePredictionDto,
  ) {
    const original = await this.prisma.prediction.findUnique({
      where: { id: originalId },
      include: { market: true, originalChallenge: true },
    });
    if (!original) throw new NotFoundException('Prediction not found');
    if (original.userId === user.userId) {
      throw new BadRequestException('Cannot challenge your own prediction');
    }
    if (original.status !== PredictionStatus.OPEN) {
      throw new BadRequestException('Prediction is not open for challenge');
    }
    if (original.originalChallenge) {
      throw new ConflictException('Prediction already locked by a challenger');
    }
    if (
      original.challengeExpiresAt &&
      original.challengeExpiresAt.getTime() <= Date.now()
    ) {
      throw new BadRequestException('Challenge window has closed');
    }
    if (dto.direction === original.direction) {
      throw new BadRequestException('Challenger must take the opposite direction');
    }

    const minHeadroom = this.config.getOrThrow<number>('minTradingHeadroomSec');
    try {
      await this.dreamdex.assertTradable(
        original.market.marketId,
        minHeadroom,
      );
    } catch (err) {
      throw new BadRequestException((err as Error).message);
    }

    const quantity = dto.quantity ?? Number(original.quantityFilled);
    const prepared = await this.dreamdex.prepareBuy({
      marketId: original.market.marketId,
      direction: dto.direction,
      quantityHuman: quantity,
    }).catch((err: Error) => {
      throw new BadRequestException(err.message);
    });

    const prediction = await this.prisma.prediction.create({
      data: {
        userId: user.userId,
        marketRowId: original.marketRowId,
        direction: dto.direction,
        confidence: this.normalizeConfidence(dto.confidence),
        quantity: new Prisma.Decimal(prepared.quantityHuman),
        yesId: prepared.yesId,
        noId: prepared.noId,
        status: PredictionStatus.PENDING,
        challengingOfId: original.id,
      },
    });

    return {
      prediction: this.serialize(prediction),
      originalPredictionId: original.id,
      order: prepared,
    };
  }

  private async confirmChallenge(
    prediction: {
      id: string;
      userId: string;
      challengingOfId: string | null;
      direction: Direction;
      confidence: Prisma.Decimal;
      market: { marketId: string; pool: string | null };
    },
    proof: { orderId: string; quantityFilled: string },
    txHash: string,
  ) {
    const originalId = prediction.challengingOfId!;
    const original = await this.prisma.prediction.findUnique({
      where: { id: originalId },
      include: { originalChallenge: true },
    });
    if (!original) throw new NotFoundException('Original prediction gone');
    if (original.status !== PredictionStatus.OPEN || original.originalChallenge) {
      throw new ConflictException('Challenge already taken');
    }
    if (original.direction === prediction.direction) {
      throw new BadRequestException('Challenge must be the opposite side');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const stillOpen = await tx.prediction.findUnique({
        where: { id: originalId },
        include: { originalChallenge: true },
      });
      if (
        !stillOpen ||
        stillOpen.status !== PredictionStatus.OPEN ||
        stillOpen.originalChallenge
      ) {
        throw new ConflictException('Challenge already taken');
      }

      const challenger = await tx.prediction.update({
        where: { id: prediction.id },
        data: {
          status: PredictionStatus.LOCKED,
          txHash,
          orderId: proof.orderId,
          quantityFilled: new Prisma.Decimal(proof.quantityFilled),
        },
      });
      await tx.prediction.update({
        where: { id: originalId },
        data: { status: PredictionStatus.LOCKED },
      });
      const challenge = await tx.challenge.create({
        data: {
          originalPredictionId: originalId,
          challengerPredictionId: challenger.id,
        },
      });
      return { challenger, challenge };
    });

    return {
      prediction: this.serialize(result.challenger),
      challenge: {
        id: result.challenge.id,
        status: result.challenge.status,
        originalPredictionId: originalId,
        challengerPredictionId: result.challenger.id,
      },
    };
  }

  normalizeConfidence(raw: number): Prisma.Decimal {
    const asUnit = raw > 1 ? raw / 100 : raw;
    if (asUnit < 0.01 || asUnit > 0.99) {
      throw new BadRequestException('Confidence must be between 1 and 99');
    }
    return new Prisma.Decimal(asUnit.toFixed(4));
  }

  serialize(p: {
    id: string;
    userId: string;
    marketRowId: string;
    direction: Direction;
    confidence: Prisma.Decimal;
    quantity: Prisma.Decimal;
    quantityFilled: Prisma.Decimal;
    orderId: string | null;
    txHash: string | null;
    status: PredictionStatus;
    challengeExpiresAt: Date | null;
    challengingOfId: string | null;
    createdAt: Date;
  }) {
    return {
      id: p.id,
      userId: p.userId,
      marketRowId: p.marketRowId,
      direction: p.direction,
      confidence: Number(p.confidence),
      quantity: p.quantity.toString(),
      quantityFilled: p.quantityFilled.toString(),
      orderId: p.orderId,
      txHash: p.txHash,
      status: p.status,
      challengeExpiresAt: p.challengeExpiresAt?.toISOString() ?? null,
      challengingOfId: p.challengingOfId,
      createdAt: p.createdAt.toISOString(),
    };
  }

  serializeOpen(p: {
    id: string;
    direction: Direction;
    confidence: Prisma.Decimal;
    quantityFilled: Prisma.Decimal;
    challengeExpiresAt: Date | null;
    createdAt: Date;
    user: { wallet: string; challengeRating: number };
    market: { marketId: string; asset: string; intervalSec: number };
  }) {
    return {
      id: p.id,
      direction: p.direction,
      confidence: Number(p.confidence),
      quantityFilled: p.quantityFilled.toString(),
      challengeExpiresAt: p.challengeExpiresAt?.toISOString() ?? null,
      createdAt: p.createdAt.toISOString(),
      predictor: {
        wallet: p.user.wallet,
        challengeRating: p.user.challengeRating,
      },
      market: {
        marketId: p.market.marketId,
        asset: p.market.asset,
        intervalSec: p.market.intervalSec,
      },
    };
  }
}
