import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SettlementService } from '../rewards/settlement.service';
import { AgentsService } from '../agents/agents.service';
import { FanNftService } from '../nft/fan-nft.service';

@Injectable()
export class FanPulseWorker {
  private readonly logger = new Logger(FanPulseWorker.name);
  private running = false;

  constructor(
    private readonly settlement: SettlementService,
    private readonly agents: AgentsService,
    private readonly fanNft: FanNftService,
  ) {}

  @Cron('*/15 * * * * *')
  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      await this.settlement.expireOpenPredictions();
      await this.settlement.resolveLockedChallenges();
      await this.agents.pollPending();
      void this.fanNft.syncPending().catch((err: unknown) => {
        this.logger.warn(`FanNFT sync: ${(err as Error).message}`);
      });
    } catch (err) {
      this.logger.error((err as Error).message);
    } finally {
      this.running = false;
    }
  }
}
