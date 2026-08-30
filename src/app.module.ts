import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { DreamdexModule } from './dreamdex/dreamdex.module';
import { MarketsModule } from './markets/markets.module';
import { PredictionsModule } from './predictions/predictions.module';
import { ChallengesModule } from './challenges/challenges.module';
import { UsersModule } from './users/users.module';
import { LeaderboardModule } from './leaderboard/leaderboard.module';
import { RewardsModule } from './rewards/rewards.module';
import { AgentsModule } from './agents/agents.module';
import { WorkersModule } from './workers/workers.module';
import { configuration } from './config/configuration';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    ScheduleModule.forRoot(),
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('jwtSecret'),
        signOptions: { expiresIn: '7d' },
      }),
    }),
    PrismaModule,
    AuthModule,
    DreamdexModule,
    MarketsModule,
    PredictionsModule,
    ChallengesModule,
    UsersModule,
    LeaderboardModule,
    RewardsModule,
    AgentsModule,
    WorkersModule,
  ],
})
export class AppModule {}
