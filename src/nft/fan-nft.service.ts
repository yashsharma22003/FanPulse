import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createPublicClient,
  createWalletClient,
  decodeEventLog,
  fallback,
  getAddress,
  http,
  type Address,
  type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { PrismaService } from '../prisma/prisma.service';
import { somniaShannon } from '../chain';
import { fanNftAbi } from './fan-nft.abi';
import { SCOUT_TIER, tierFromRating, tierName } from './tiers';

@Injectable()
export class FanNftService {
  private readonly logger = new Logger(FanNftService.name);
  private syncing = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  profileFanNft(user: {
    challengeRating: number;
    fanNftTier: number | null;
    fanNftTokenId: number | null;
    fanNftTxHash: string | null;
  }) {
    const minted = user.fanNftTokenId != null;
    return {
      tier: minted ? tierName(user.fanNftTier ?? 0) : ('ROOKIE' as const),
      tokenId: user.fanNftTokenId,
      contract: this.config.get<string | undefined>('fanNftAddress') ?? null,
      lastUpdateTxHash: user.fanNftTxHash,
    };
  }

  async tokenURI(tokenId: number | null): Promise<string | null> {
    if (tokenId == null) return null;
    const address = this.config.get<string | undefined>('fanNftAddress');
    if (!address) return null;
    try {
      const client = createPublicClient({
        chain: somniaShannon,
        transport: fallback([
          http(this.config.getOrThrow<string>('rpcUrl')),
          http(this.config.getOrThrow<string>('rpcUrlFallback')),
        ]),
      });
      return await client.readContract({
        address: address as Address,
        abi: fanNftAbi,
        functionName: 'tokenURI',
        args: [BigInt(tokenId)],
      });
    } catch {
      return null;
    }
  }

  async syncPending() {
    if (this.syncing) return;
    this.syncing = true;
    try {
      const pending = await this.prisma.user.findMany({
        where: { fanNftSyncPending: true },
        take: 20,
      });
      for (const user of pending) {
        try {
          await this.syncUser(user);
        } catch (err) {
          this.logger.warn(
            `FanNFT sync ${user.wallet}: ${(err as Error).message}`,
          );
        }
      }
    } finally {
      this.syncing = false;
    }
  }

  private async syncUser(user: {
    id: string;
    wallet: string;
    challengeRating: number;
    fanNftTier: number | null;
    fanNftTokenId: number | null;
  }) {
    const desired = tierFromRating(user.challengeRating);
    const minted = user.fanNftTokenId != null;

    if (!minted && desired < SCOUT_TIER) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { fanNftSyncPending: false },
      });
      return;
    }

    if (minted && user.fanNftTier === desired) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { fanNftSyncPending: false },
      });
      return;
    }

    const nft = this.config.get<string | undefined>('fanNftAddress');
    const pk =
      this.config.get<string | undefined>('fanNftPrivateKey') ||
      this.config.get<string | undefined>('agentsPrivateKey');
    if (!nft || !pk) {
      this.logger.warn('FanNFT skipped: FAN_NFT_ADDRESS or protocol key unset');
      return;
    }

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

    const hash = await wallet.writeContract({
      chain: somniaShannon,
      account,
      address: nft as Address,
      abi: fanNftAbi,
      functionName: 'setTier',
      args: [getAddress(user.wallet), desired],
    });

    const publicClient = createPublicClient({
      chain: somniaShannon,
      transport: fallback([
        http(this.config.getOrThrow<string>('rpcUrl')),
        http(this.config.getOrThrow<string>('rpcUrlFallback')),
      ]),
    });
    const receipt = await publicClient.waitForTransactionReceipt({
      hash,
      timeout: 60_000,
    });
    if (receipt.status !== 'success') {
      throw new Error(`setTier reverted tx=${hash}`);
    }
    let tokenId = user.fanNftTokenId;
    for (const log of receipt.logs) {
      try {
        const decoded = decodeEventLog({
          abi: fanNftAbi,
          data: log.data,
          topics: log.topics,
        });
        if (decoded.eventName === 'TierUpdated') {
          tokenId = Number(decoded.args.tokenId);
        }
      } catch {
        /* ignore */
      }
    }
    if (tokenId == null) {
      tokenId = Number(
        await publicClient.readContract({
          address: nft as Address,
          abi: fanNftAbi,
          functionName: 'tokenOfWallet',
          args: [getAddress(user.wallet)],
        }),
      );
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        fanNftTier: desired,
        fanNftTokenId: tokenId,
        fanNftTxHash: hash,
        fanNftSyncPending: false,
      },
    });
    this.logger.log(
      `FanNFT ${user.wallet} → ${tierName(desired)} token=${tokenId} tx=${hash}`,
    );
  }
}
