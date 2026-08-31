import { Module } from '@nestjs/common';
import { FanNftService } from './fan-nft.service';

@Module({
  providers: [FanNftService],
  exports: [FanNftService],
})
export class FanNftModule {}
