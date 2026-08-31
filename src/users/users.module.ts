import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { FanNftModule } from '../nft/fan-nft.module';

@Module({
  imports: [FanNftModule],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
