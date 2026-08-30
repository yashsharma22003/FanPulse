import { Module } from '@nestjs/common';
import { FanPulseWorker } from './fanpulse.worker';
import { RewardsModule } from '../rewards/rewards.module';
import { AgentsModule } from '../agents/agents.module';

@Module({
  imports: [RewardsModule, AgentsModule],
  providers: [FanPulseWorker],
})
export class WorkersModule {}
