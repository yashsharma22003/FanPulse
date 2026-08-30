import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SettlementService } from '../rewards/settlement.service';
import { AgentsService } from '../agents/agents.service';

@Injectable()
export class FanPulseWorker {
  private readonly logger = new Logger(FanPulseWorker.name);
  private running = false;

  constructor(
    private readonly settlement: SettlementService,
    private readonly agents: AgentsService,
  ) {}

  @Cron('*/15 * * * * *')
  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      await this.settlement.expireOpenPredictions();
      await this.settlement.resolveLockedChallenges();
      await this.agents.pollPending();
    } catch (err) {
      this.logger.error((err as Error).message);
    } finally {
      this.running = false;
    }
  }
}
