import { Module, forwardRef } from '@nestjs/common';
import { MarketsController } from './markets.controller';
import { MarketsService } from './markets.service';
import { AgentsModule } from '../agents/agents.module';

@Module({
  imports: [forwardRef(() => AgentsModule)],
  controllers: [MarketsController],
  providers: [MarketsService],
  exports: [MarketsService],
})
export class MarketsModule {}
