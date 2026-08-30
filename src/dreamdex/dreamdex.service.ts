import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createPublicClient,
  encodeFunctionData,
  fallback,
  getAddress,
  http,
  maxUint256,
  parseEventLogs,
  zeroAddress,
  type Address,
  type Hex,
} from 'viem';
import type {
  BinaryMarket,
  BinaryOrderBook,
  BinaryBookParams,
  FillRow,
  MarketOnchain,
  SomniaMarkets,
  SomniaMarketsClient,
} from '@somnia-chain/markets-sdk';
import {
  binaryPoolEventsAbi,
  binaryPoolWriteAbi,
  erc20WriteAbi,
  orderBookEventsAbi,
} from './abis';
import { loadEsm } from '../load-esm';
import { somniaShannon } from '../chain';

type HttpClient = ReturnType<typeof createPublicClient>;

export type UnsignedTx = {
  to: Address;
  data: Hex;
  value: string;
  chainId: number;
  description: string;
};

export type PreparedOrder = {
  marketId: Hex;
  pool: Address;
  collateral: Address;
  side: 'BUY_YES' | 'BUY_NO';
  kind: number;
  direction: 'UP' | 'DOWN';
  quantityHuman: string;
  quantityRaw: string;
  priceHuman: number;
  priceRaw: string;
  expireTimestampNs: string;
  decimals: number;
  yesId: string;
  noId: string;
  upSymbol?: string;
  downSymbol?: string;
  approval: UnsignedTx;
  order: UnsignedTx;
};

export type FillProof = {
  orderId: string;
  quantityFilled: string;
  txHash: Hex;
  kind: number;
};

const ONCHAIN_TRADING = 1;
const ORDER_KIND = { BUY_YES: 0, SELL_YES: 1, BUY_NO: 2, SELL_NO: 3 } as const;
const ORDER_TYPE_IOC = 2;

@Injectable()
export class DreamdexService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DreamdexService.name);
  private exchange: SomniaMarkets | null = null;
  private httpClient: HttpClient | null = null;
  private toHuman!: (
    raw: bigint | string,
    decimals?: number,
  ) => number;
  private fromHuman!: (
    human: number | string,
    decimals?: number,
  ) => bigint;
  private probabilityToPrice!: (
    probability: number,
    decimals?: number,
  ) => bigint;
  private priceToProbability!: (
    rawPrice: bigint | string,
    decimals?: number,
  ) => number;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    await this.initSdk();
  }

  async onModuleDestroy() {
    await this.exchange?.close();
  }

  get client(): SomniaMarketsClient {
    if (!this.exchange) {
      throw new Error('DreamDEX SDK not initialized');
    }
    return this.exchange.client;
  }

  get publicClient(): HttpClient {
    if (!this.httpClient) {
      throw new Error('HTTP RPC client not initialized');
    }
    return this.httpClient;
  }

  private async initSdk() {
    const sdk = await loadEsm<typeof import('@somnia-chain/markets-sdk')>(
      '@somnia-chain/markets-sdk',
    );
    this.toHuman = sdk.toHuman;
    this.fromHuman = sdk.fromHuman;
    this.probabilityToPrice = sdk.probabilityToPrice;
    this.priceToProbability = sdk.priceToProbability;

    const wsUrl = this.config.getOrThrow<string>('wsRpcUrl');
    this.exchange = new sdk.SomniaMarkets({
      indexerUrl: this.config.getOrThrow<string>('indexerUrl'),
      chain: somniaShannon,
      wsRpcUrl: wsUrl,
      addresses: sdk.SOMNIA_TESTNET_ADDRESSES,
    });

    const rpcUrl = this.config.getOrThrow<string>('rpcUrl');
    const rpcFallback = this.config.getOrThrow<string>('rpcUrlFallback');
    this.httpClient = createPublicClient({
      chain: somniaShannon,
      transport: fallback([http(rpcUrl), http(rpcFallback)]),
    });

    this.logger.log(`DreamDEX SDK ready (ws=${wsUrl})`);
  }

  venueFilter() {
    const venueId = this.config.get<string | undefined>('venueId');
    return venueId ? { venueId } : {};
  }

  async listLiveBinaryMarkets(limit = 50): Promise<BinaryMarket[]> {
    return this.client.listLiveBinaryMarkets({
      ...this.venueFilter(),
      limit,
    });
  }

  async getBinaryMarket(marketId: string): Promise<BinaryMarket | null> {
    const id = this.normalizeMarketId(marketId);
    return this.client.getBinaryMarket(id);
  }

  async getMarketOnchain(marketId: string): Promise<MarketOnchain> {
    return this.client.getMarketOnchain(this.normalizeMarketId(marketId));
  }

  async getBook(pool: Address): Promise<BinaryOrderBook> {
    return this.client.getBinaryOrderBook(pool, { depth: 8 });
  }

  async getBookParams(pool: Address): Promise<BinaryBookParams> {
    return this.client.getBinaryBookParams(pool);
  }

  async getOpeningPrices(
    marketIds: string[],
  ): Promise<Record<string, string | null>> {
    return this.client.getOpeningPrices(marketIds);
  }

  async getMarketResolution(marketId: string) {
    return this.client.getMarketResolution(this.normalizeMarketId(marketId));
  }

  async getOutcomeBalance(
    outcomeToken: Address,
    account: Address,
    id: bigint,
  ): Promise<bigint> {
    return this.client.getOutcomeBalance({
      outcomeToken,
      account,
      id,
    });
  }

  secondsLeft(expiryUnixSec: number | string | bigint): number {
    const expiry = Number(expiryUnixSec);
    return expiry - Date.now() / 1000;
  }

  isTradingOnchain(status: number): boolean {
    return status === ONCHAIN_TRADING;
  }

  midProbability(book: BinaryOrderBook, decimals: number): number | null {
    const bid = book.yesBids[0]?.price;
    const ask = book.yesAsks[0]?.price;
    if (bid === undefined && ask === undefined) return null;
    if (bid !== undefined && ask !== undefined) {
      return this.priceToProbability((bid + ask) / 2n, decimals);
    }
    const raw = bid ?? ask;
    return raw === undefined ? null : this.priceToProbability(raw, decimals);
  }

  async assertTradable(marketId: string, minHeadroomSec: number) {
    const onchain = await this.getMarketOnchain(marketId);
    if (!this.isTradingOnchain(onchain.status)) {
      throw Object.assign(new Error('Market is not in Trading'), {
        status: 400,
        onchainStatus: onchain.status,
      });
    }
    const left = this.secondsLeft(onchain.expiry);
    if (left < minHeadroomSec) {
      throw Object.assign(
        new Error(
          `Market closes in ${Math.floor(left)}s; need ${minHeadroomSec}s headroom`,
        ),
        { status: 400 },
      );
    }
    return { onchain, secondsLeft: left };
  }

  async prepareBuy(opts: {
    marketId: string;
    direction: 'UP' | 'DOWN';
    quantityHuman: number;
  }): Promise<PreparedOrder> {
    const marketId = this.normalizeMarketId(opts.marketId);
    const indexed = await this.getBinaryMarket(marketId);
    if (!indexed) {
      throw Object.assign(new Error('Unknown binary market'), { status: 404 });
    }
    const onchain = await this.getMarketOnchain(marketId);
    const decimals = onchain.decimals || indexed.quoteDecimals || 6;
    const params = await this.getBookParams(onchain.pool);
    const book = await this.getBook(onchain.pool);

    let qty = this.fromHuman(opts.quantityHuman, decimals);
    qty = (qty / params.lotSize) * params.lotSize;
    if (qty < params.minQuantity) {
      throw Object.assign(
        new Error(
          `Quantity below min lot (${this.toHuman(params.minQuantity, decimals)})`,
        ),
        { status: 400 },
      );
    }

    const side = opts.direction === 'UP' ? 'BUY_YES' : 'BUY_NO';
    const kind = ORDER_KIND[side];
    const one = 10n ** BigInt(decimals);
    const tick = params.tickSize;

    let yesPrice: bigint;
    if (side === 'BUY_YES') {
      const ask = book.yesAsks[0]?.price;
      yesPrice = ask !== undefined ? this.snapUp(ask + tick * 10n, tick, one) : this.snapDown(one - tick, tick);
    } else {
      const noAsk = book.noAsks[0]?.price;
      if (noAsk !== undefined) {
        const complementary = one > noAsk ? one - noAsk : tick;
        yesPrice = this.snapDown(complementary > tick * 10n ? complementary - tick * 10n : tick, tick);
      } else {
        yesPrice = tick;
      }
    }
    if (yesPrice < tick) yesPrice = tick;
    if (yesPrice >= one) yesPrice = one - tick;

    const nowSec = BigInt(Math.floor(Date.now() / 1000));
    const marketExpiry = onchain.expiry;
    let expireSec = nowSec + 300n;
    if (expireSec >= marketExpiry) {
      expireSec = marketExpiry > nowSec + 5n ? marketExpiry - 1n : nowSec + 1n;
    }
    const expireTimestampNs = expireSec * 1_000_000_000n;

    const chainId = this.config.getOrThrow<number>('chainId');
    const orderData = encodeFunctionData({
      abi: binaryPoolWriteAbi,
      functionName: 'placeBinaryOrder',
      args: [
        kind,
        yesPrice,
        qty,
        expireTimestampNs,
        ORDER_TYPE_IOC,
        0,
        zeroAddress,
        0n,
        0n,
      ],
    });
    const approvalData = encodeFunctionData({
      abi: erc20WriteAbi,
      functionName: 'approve',
      args: [onchain.pool, maxUint256],
    });

    return {
      marketId,
      pool: onchain.pool,
      collateral: onchain.collateral,
      side,
      kind,
      direction: opts.direction,
      quantityHuman: this.toHuman(qty, decimals).toString(),
      quantityRaw: qty.toString(),
      priceHuman: this.priceToProbability(yesPrice, decimals),
      priceRaw: yesPrice.toString(),
      expireTimestampNs: expireTimestampNs.toString(),
      decimals,
      yesId: onchain.yesId.toString(),
      noId: onchain.noId.toString(),
      upSymbol: indexed.asset
        ? `${indexed.asset}-${indexed.interval ?? indexed.intervalSec}/YES`
        : undefined,
      downSymbol: indexed.asset
        ? `${indexed.asset}-${indexed.interval ?? indexed.intervalSec}/NO`
        : undefined,
      approval: {
        to: onchain.collateral,
        data: approvalData,
        value: '0',
        chainId,
        description: 'Approve collateral for BinaryPool',
      },
      order: {
        to: onchain.pool,
        data: orderData,
        value: '0',
        chainId,
        description: `IOC ${side} ${this.toHuman(qty, decimals)} contracts`,
      },
    };
  }

  async verifyFill(opts: {
    txHash: Hex;
    wallet: Address;
    marketId: string;
    expectedKind: number;
    pool: Address;
  }): Promise<FillProof> {
    const receipt = await this.publicClient.waitForTransactionReceipt({
      hash: opts.txHash,
      timeout: 60_000,
    });
    if (receipt.status !== 'success') {
      throw Object.assign(new Error('Transaction reverted'), { status: 400 });
    }
    const from = getAddress(receipt.from);
    const wallet = getAddress(opts.wallet);
    if (from.toLowerCase() !== wallet.toLowerCase()) {
      throw Object.assign(
        new Error('Transaction sender does not match authenticated wallet'),
        { status: 403 },
      );
    }

    const placed = parseEventLogs({
      abi: orderBookEventsAbi,
      logs: receipt.logs,
      eventName: 'OrderPlaced',
    });
    const kinds = parseEventLogs({
      abi: binaryPoolEventsAbi,
      logs: receipt.logs,
      eventName: 'BinaryOrderPlaced',
    });
    const fills = parseEventLogs({
      abi: orderBookEventsAbi,
      logs: receipt.logs,
      eventName: 'OrderFilled',
    });

    if (placed.length === 0) {
      throw Object.assign(
        new Error('No OrderPlaced in receipt — not a DreamDEX binary order'),
        { status: 400 },
      );
    }

    const ourPlaced = placed.filter((log) => {
      const owner = log.args.placedOrder?.owner;
      return owner && getAddress(owner).toLowerCase() === wallet.toLowerCase();
    });
    if (ourPlaced.length === 0) {
      throw Object.assign(
        new Error('No order in this tx owned by the authenticated wallet'),
        { status: 400 },
      );
    }

    const orderId = ourPlaced[0].args.orderId.toString();

    const kindLog = kinds.find(
      (log) => log.args.orderId.toString() === orderId,
    );
    const kind = kindLog ? Number(kindLog.args.kind) : opts.expectedKind;
    if (kind !== opts.expectedKind) {
      throw Object.assign(
        new Error(
          `Order kind ${kind} does not match expected ${opts.expectedKind}`,
        ),
        { status: 400 },
      );
    }

    let filled = 0n;
    for (const fill of fills) {
      if (fill.args.takerOrderId.toString() === orderId) {
        filled += fill.args.quantityFilled;
      }
    }

    if (filled === 0n) {
      const onchain = await this.getMarketOnchain(opts.marketId);
      const tokenId =
        opts.expectedKind === ORDER_KIND.BUY_YES ? onchain.yesId : onchain.noId;
      filled = await this.getOutcomeBalance(
        onchain.outcomeToken,
        wallet,
        tokenId,
      );
    }

    if (filled === 0n) {
      const indexedFills = await this.waitForIndexedFills(
        wallet,
        opts.pool,
        opts.txHash,
      );
      for (const row of indexedFills) {
        filled += BigInt(row.quantity);
      }
    }

    if (filled === 0n) {
      throw Object.assign(
        new Error(
          'IOC order did not fill. Wait for book liquidity or retry with a complementary opposite buy.',
        ),
        { status: 400 },
      );
    }

    const indexed = await this.getBinaryMarket(opts.marketId);
    const decimals = indexed?.quoteDecimals ?? 6;

    return {
      orderId,
      quantityFilled: this.toHuman(filled, decimals).toString(),
      txHash: opts.txHash,
      kind,
    };
  }

  kindForDirection(direction: 'UP' | 'DOWN'): number {
    return direction === 'UP' ? ORDER_KIND.BUY_YES : ORDER_KIND.BUY_NO;
  }

  normalizeMarketId(id: string): Hex {
    const hex = id.startsWith('0x') ? id : `0x${id}`;
    return hex.toLowerCase() as Hex;
  }

  humanToRaw(human: number | string, decimals: number): bigint {
    return this.fromHuman(human, decimals);
  }

  rawToHuman(raw: bigint | string, decimals: number): number {
    return this.toHuman(raw, decimals);
  }

  private snapDown(raw: bigint, tick: bigint): bigint {
    if (tick === 0n) return raw;
    return (raw / tick) * tick;
  }

  private snapUp(raw: bigint, tick: bigint, one: bigint): bigint {
    if (tick === 0n) return raw;
    const snapped = ((raw + tick - 1n) / tick) * tick;
    return snapped >= one ? one - tick : snapped;
  }

  private async waitForIndexedFills(
    wallet: Address,
    pool: Address,
    txHash: Hex,
  ): Promise<FillRow[]> {
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline) {
      const rows = await this.client.getUserFills(wallet, {
        pool,
        limit: 20,
        since: Math.floor(Date.now() / 1000) - 600,
      });
      const matched = rows.filter(
        (r) => r.txHash.toLowerCase() === txHash.toLowerCase(),
      );
      if (matched.length > 0) return matched;
      await new Promise((r) => setTimeout(r, 1500));
    }
    return [];
  }
}
