import {
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiStatus, Direction, PredictionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DreamdexService } from '../dreamdex/dreamdex.service';
import { AgentsService } from '../agents/agents.service';

@Injectable()
export class MarketsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dreamdex: DreamdexService,
    private readonly agents: AgentsService,
    private readonly config: ConfigService,
  ) {}

  async listLive() {
    let live;
    try {
      live = await this.dreamdex.listLiveBinaryMarkets(50);
    } catch (err) {
      throw new ServiceUnavailableException(
        `DreamDEX indexer unavailable: ${(err as Error).message}`,
      );
    }
    const minHeadroom = this.config.getOrThrow<number>('minTradingHeadroomSec');
    const rows = [];
    for (const m of live) {
      const row = await this.upsertFromIndexed(m);
      const left = this.dreamdex.secondsLeft(m.expiry);
      rows.push({
        ...this.serialize(row),
        secondsLeft: Math.max(0, Math.floor(left)),
        tradable: left >= minHeadroom,
      });
    }
    return rows;
  }

  async getState(marketId: string, wallet?: string) {
    let indexed;
    try {
      indexed = await this.dreamdex.getBinaryMarket(marketId);
    } catch (err) {
      throw new ServiceUnavailableException(
        `DreamDEX indexer unavailable: ${(err as Error).message}`,
      );
    }
    if (!indexed) {
      throw Object.assign(new Error('Market not found'), { status: 404 });
    }
    const row = await this.upsertFromIndexed(indexed);
    const onchain = await this.dreamdex.getMarketOnchain(indexed.marketId);
    const book = await this.dreamdex.getBook(onchain.pool);
    const decimals = onchain.decimals || indexed.quoteDecimals || 6;
    const mid = this.dreamdex.midProbability(book, decimals);
    const secondsLeft = Math.max(0, Math.floor(this.dreamdex.secondsLeft(onchain.expiry)));

    if (row.aiStatus === AiStatus.IDLE) {
      void this.agents.enqueueForMarket(row.id).catch((err: unknown) => {
        console.error('AI enqueue failed', err);
      });
    }

    const community = await this.communityUpPercent(row.id);
    let userPercent: number | null = null;
    if (wallet) {
      const user = await this.prisma.user.findUnique({
        where: { wallet: wallet.toLowerCase() },
      });
      if (user) {
        const pred = await this.prisma.prediction.findFirst({
          where: {
            userId: user.id,
            marketRowId: row.id,
            status: { in: [PredictionStatus.OPEN, PredictionStatus.LOCKED] },
          },
          orderBy: { createdAt: 'desc' },
        });
        if (pred) {
          userPercent = this.statedAsUpPercent(pred.direction, Number(pred.confidence));
        }
      }
    }

    let opening: string | null = null;
    try {
      const opens = await this.dreamdex.getOpeningPrices([indexed.marketId]);
      opening = opens[indexed.marketId.toLowerCase()] ?? null;
    } catch {
      opening = null;
    }

    const minHeadroom = this.config.getOrThrow<number>('minTradingHeadroomSec');
    const tradable =
      this.dreamdex.isTradingOnchain(onchain.status) &&
      secondsLeft >= minHeadroom &&
      !onchain.isResolved &&
      !onchain.isVoided;

    return {
      ...this.serialize(row),
      onchainStatus: onchain.status,
      isResolved: onchain.isResolved,
      isVoided: onchain.isVoided,
      winningOutcome: onchain.isResolved ? onchain.winningOutcome : null,
      pool: onchain.pool,
      secondsLeft,
      tradable,
      odds: {
        pUp: mid == null ? null : Math.round(mid * 1000) / 10,
        bestBid: book.yesBids[0]
          ? this.dreamdex.rawToHuman(book.yesBids[0].price, decimals)
          : null,
        bestAsk: book.yesAsks[0]
          ? this.dreamdex.rawToHuman(book.yesAsks[0].price, decimals)
          : null,
      },
      aiPercent: row.aiProbability,
      communityPercent: community,
      userPercent,
      openingPrice: opening,
      question: indexed.question,
    };
  }

  async upsertFromIndexed(m: {
    marketId: string;
    asset: string;
    intervalSec?: string | null;
    tradingStart: string;
    expiry: string;
    poolAddress: string;
    venueId?: string | null;
  }) {
    const intervalSec = m.intervalSec ? parseInt(m.intervalSec, 10) : 0;
    const tradingStart = new Date(Number(m.tradingStart) * 1000);
    const expiry = new Date(Number(m.expiry) * 1000);
    return this.prisma.market.upsert({
      where: { marketId: m.marketId.toLowerCase() },
      create: {
        marketId: m.marketId.toLowerCase(),
        asset: m.asset,
        intervalSec,
        tradingStart,
        expiry,
        pool: m.poolAddress,
        venueId: m.venueId ?? undefined,
      },
      update: {
        asset: m.asset,
        intervalSec,
        tradingStart,
        expiry,
        pool: m.poolAddress,
        venueId: m.venueId ?? undefined,
      },
    });
  }

  async communityUpPercent(marketRowId: string): Promise<number | null> {
    const preds = await this.prisma.prediction.findMany({
      where: {
        marketRowId,
        status: { in: [PredictionStatus.OPEN, PredictionStatus.LOCKED] },
      },
    });
    if (preds.length === 0) return null;
    const sum = preds.reduce(
      (acc, p) =>
        acc + this.statedAsUpPercent(p.direction, Number(p.confidence)),
      0,
    );
    return Math.round((sum / preds.length) * 10) / 10;
  }

  statedAsUpPercent(direction: Direction, confidence: number): number {
    const c = confidence * 100;
    return direction === Direction.UP ? c : 100 - c;
  }

  serialize(row: {
    id: string;
    marketId: string;
    asset: string;
    intervalSec: number;
    tradingStart: Date | null;
    expiry: Date;
    pool: string | null;
    venueId: string | null;
    onchainStatus: number;
    aiProbability: number | null;
    aiStatus: AiStatus;
  }) {
    return {
      id: row.id,
      marketId: row.marketId,
      asset: row.asset,
      intervalSec: row.intervalSec,
      tradingStart: row.tradingStart?.toISOString() ?? null,
      expiry: row.expiry.toISOString(),
      pool: row.pool,
      venueId: row.venueId,
      onchainStatus: row.onchainStatus,
      aiPercent: row.aiProbability,
      aiStatus: row.aiStatus,
    };
  }
}
