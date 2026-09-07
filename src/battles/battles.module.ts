import { Module } from '@nestjs/common';
import { BattlesController } from './battles.controller';
import { BattlesService } from './battles.service';
import { BattleSettlementService } from './battle-settlement.service';
import { BattleRatingCalculator } from './battle-rating.calculator';
import { MarketsModule } from '../markets/markets.module';
import { PredictionsModule } from '../predictions/predictions.module';
import { RewardsModule } from '../rewards/rewards.module';

@Module({
  imports: [MarketsModule, PredictionsModule, RewardsModule],
  controllers: [BattlesController],
  providers: [
    BattlesService,
    BattleSettlementService,
    BattleRatingCalculator,
  ],
  exports: [BattlesService, BattleSettlementService],
})
export class BattlesModule {}
