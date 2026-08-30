import { Module } from '@nestjs/common';
import { EnergyService } from './energy.service';
import { EloRatingCalculator } from './elo-rating.calculator';
import { SettlementService } from './settlement.service';

@Module({
  providers: [EnergyService, EloRatingCalculator, SettlementService],
  exports: [EnergyService, EloRatingCalculator, SettlementService],
})
export class RewardsModule {}
