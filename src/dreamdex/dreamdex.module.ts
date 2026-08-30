import { Global, Module } from '@nestjs/common';
import { DreamdexService } from './dreamdex.service';

@Global()
@Module({
  providers: [DreamdexService],
  exports: [DreamdexService],
})
export class DreamdexModule {}
