import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiStatus } from '@prisma/client';
import {
  createWalletClient,
  decodeAbiParameters,
  decodeEventLog,
  encodeFunctionData,
  fallback,
  http,
  parseEther,
  toFunctionSelector,
  zeroAddress,
  type Address,
  type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { PrismaService } from '../prisma/prisma.service';
import { DreamdexService } from '../dreamdex/dreamdex.service';
import { somniaShannon } from '../chain';
import {
  agentRequesterAbi,
  handleResponseAbi,
  inferNumberAbi,
} from './agents.abi';

const LLM_PER_AGENT = parseEther('0.07');
const SUBCOMMITTEE = 3n;
const RECEIPTS_URL = 'https://receipts.testnet.agents.somnia.host';

/** Protocol wallet pays STT for one cached inferNumber per market window. */

@Injectable()
export class AgentsService {
  private readonly logger = new Logger(AgentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly dreamdex: DreamdexService,
  ) {}

  async enqueueForMarket(marketRowId: string) {
    const key = this.config.get<string | undefined>('agentsPrivateKey');
    const agentId = this.config.get<string | undefined>('llmAgentId');
    if (!key || !agentId) {
      this.logger.warn(
        'Skipping inferNumber: SOMNIA_LLM_AGENT_ID or AGENTS_PRIVATE_KEY unset',
      );
      return;
    }

    const claimed = await this.prisma.market.updateMany({
      where: { id: marketRowId, aiStatus: AiStatus.IDLE },
      data: { aiStatus: AiStatus.PENDING },
    });
    if (claimed.count === 0) return;

    const market = await this.prisma.market.findUnique({
      where: { id: marketRowId },
    });
    if (!market) return;

    try {
      const requestId = await this.submitInferNumber(market);
      await this.prisma.market.update({
        where: { id: marketRowId },
        data: { aiRequestId: requestId.toString() },
      });
      this.logger.log(
        `inferNumber submitted market=${market.marketId} requestId=${requestId}`,
      );
    } catch (err) {
      this.logger.error(`inferNumber submit failed: ${(err as Error).message}`);
      await this.prisma.market.update({
        where: { id: marketRowId },
        data: { aiStatus: AiStatus.FAILED },
      });
    }
  }

  async pollPending() {
    const pending = await this.prisma.market.findMany({
      where: { aiStatus: AiStatus.PENDING, aiRequestId: { not: null } },
    });
    for (const market of pending) {
      if (!market.aiRequestId) continue;
      try {
        const value = await this.readResult(BigInt(market.aiRequestId));
        if (value === null) continue;
        const clamped = Math.max(0, Math.min(100, Number(value)));
        await this.prisma.market.update({
          where: { id: market.id },
          data: { aiStatus: AiStatus.READY, aiProbability: clamped },
        });
        this.logger.log(
          `AI ready market=${market.marketId} pUp=${clamped}`,
        );
      } catch (err) {
        this.logger.warn(
          `AI poll ${market.aiRequestId}: ${(err as Error).message}`,
        );
      }
    }
  }

  private async submitInferNumber(market: {
    marketId: string;
    asset: string;
    intervalSec: number;
  }): Promise<bigint> {
    const pk = this.config.getOrThrow<string>('agentsPrivateKey');
    const account = privateKeyToAccount(
      (pk.startsWith('0x') ? pk : `0x${pk}`) as Hex,
    );
    const wallet = createWalletClient({
      account,
      chain: somniaShannon,
      transport: fallback([
        http(this.config.getOrThrow<string>('rpcUrl')),
        http(this.config.getOrThrow<string>('rpcUrlFallback')),
      ]),
    });

    let mid: number | null = null;
    try {
      const onchain = await this.dreamdex.getMarketOnchain(market.marketId);
      const book = await this.dreamdex.getBook(onchain.pool);
      mid = this.dreamdex.midProbability(book, onchain.decimals || 6);
    } catch {
      mid = null;
    }

    const cadence =
      market.intervalSec >= 3600
        ? `${Math.round(market.intervalSec / 3600)}h`
        : `${Math.round(market.intervalSec / 60)}m`;
    const prompt = [
      `DreamDEX Event Contract: will ${market.asset} close at or above its opening price over this ${cadence} window?`,
      mid !== null
        ? `Current on-chain book-implied P(Up) is ${(mid * 100).toFixed(1)}%.`
        : 'Book is thin; no reliable mid.',
      'Return a single integer 0-100 for your independent estimate of P(Up) as a percent.',
    ].join(' ');

    const payload = encodeFunctionData({
      abi: inferNumberAbi,
      functionName: 'inferNumber',
      args: [
        prompt,
        'You estimate directional crypto event-contract probabilities. Reply with one integer 0-100.',
        0n,
        100n,
        false,
      ],
    });

    const platform = this.config.getOrThrow<string>(
      'agentsPlatform',
    ) as Address;
    const publicClient = this.dreamdex.publicClient;
    const floor = (await publicClient.readContract({
      address: platform,
      abi: agentRequesterAbi,
      functionName: 'getRequestDeposit',
    })) as bigint;
    const deposit = floor + LLM_PER_AGENT * SUBCOMMITTEE;

    const callback = (this.config.get<string | undefined>(
      'agentsCallbackAddress',
    ) || zeroAddress) as Address;
    const selector =
      callback === zeroAddress
        ? '0x00000000'
        : toFunctionSelector(handleResponseAbi[0]);

    const hash = await wallet.writeContract({
      chain: somniaShannon,
      account,
      address: platform,
      abi: agentRequesterAbi,
      functionName: 'createRequest',
      args: [
        BigInt(this.config.getOrThrow<string>('llmAgentId')),
        callback,
        selector as Hex,
        payload,
      ],
      value: deposit,
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    const created = receipt.logs
      .map((log) => {
        try {
          return decodeEventLog({
            abi: agentRequesterAbi,
            data: log.data,
            topics: log.topics,
          });
        } catch {
          return null;
        }
      })
      .find((e) => e && e.eventName === 'RequestCreated');
    if (!created || created.eventName !== 'RequestCreated') {
      throw new Error('RequestCreated event missing');
    }
    return created.args.requestId as bigint;
  }

  private async readResult(requestId: bigint): Promise<bigint | null> {
    const fromReceipts = await this.readReceipts(requestId);
    if (fromReceipts !== null) return fromReceipts;
    return this.readOnchainRequest(requestId);
  }

  /** Testnet `getRequest` currently reverts (0x4ec726c7); receipts are the source of truth. */
  private async readOnchainRequest(requestId: bigint): Promise<bigint | null> {
    const platform = this.config.getOrThrow<string>(
      'agentsPlatform',
    ) as Address;
    try {
      const req = (await this.dreamdex.publicClient.readContract({
        address: platform,
        abi: agentRequesterAbi,
        functionName: 'getRequest',
        args: [requestId],
      })) as {
        status: number | bigint;
        responses: readonly { result: Hex }[];
      };
      const status = Number(req.status);
      if (status === 1 || status === 0) return null;
      if (status !== 2) {
        throw new Error(`Agent request status ${status}`);
      }
      if (!req.responses?.length) return null;
      const [value] = decodeAbiParameters(
        [{ type: 'int256' }],
        req.responses[0].result,
      );
      return value;
    } catch {
      return null;
    }
  }

  private async readReceipts(requestId: bigint): Promise<bigint | null> {
    const platform = this.config.getOrThrow<string>('agentsPlatform');
    const url = `${RECEIPTS_URL}/agent-receipts?contractAddress=${platform}&requestId=${requestId}&type=minimal`;
    const res = await fetch(url);
    if (res.status === 404) return null;
    if (!res.ok) return null;
    const body = (await res.json()) as {
      receipts?: {
        status?: string;
        agentReceipt?: { result?: Hex };
        response?: { result?: Hex };
      }[];
    };
    const hexes = (body.receipts ?? [])
      .filter((r) => r.status === 'success')
      .map((r) => r.agentReceipt?.result ?? r.response?.result)
      .filter((h): h is Hex => typeof h === 'string' && h.startsWith('0x'));
    if (hexes.length < 2) return null;
    const counts = new Map<string, number>();
    for (const h of hexes) {
      const key = h.toLowerCase();
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const majority = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    if (!majority || majority[1] < 2) return null;
    const [value] = decodeAbiParameters(
      [{ type: 'int256' }],
      majority[0] as Hex,
    );
    return value;
  }
}
