import { Module } from '@nestjs/common';
import { FanPulseWorker } from './fanpulse.worker';
import { RewardsModule } from '../rewards/rewards.module';
import { AgentsModule } from '../agents/agents.module';
import { FanNftModule } from '../nft/fan-nft.module';

@Module({
  imports: [RewardsModule, AgentsModule, FanNftModule],
  providers: [FanPulseWorker],
})
export class WorkersModule {}
