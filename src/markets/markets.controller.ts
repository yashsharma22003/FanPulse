import { Controller, Get, NotFoundException, Param, Req, UseGuards } from '@nestjs/common';
import { MarketsService } from './markets.service';
import { Public } from '../auth/public.decorator';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import type { AuthUser } from '../auth/current-user.decorator';

@Public()
@Controller('markets')
export class MarketsController {
  constructor(private readonly markets: MarketsService) {}

  @Get()
  list() {
    return this.markets.listLive();
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get(':marketId')
  async get(
    @Param('marketId') marketId: string,
    @Req() req: { user?: AuthUser },
  ) {
    try {
      return await this.markets.getState(marketId, req.user?.wallet);
    } catch (err) {
      const e = err as { status?: number; message?: string };
      if (e.status === 404) throw new NotFoundException(e.message);
      throw err;
    }
  }
}
