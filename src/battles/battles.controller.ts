import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { BattleStatus } from '@prisma/client';
import type { Response } from 'express';
import { BattlesService } from './battles.service';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator';
import { Public } from '../auth/public.decorator';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { EnterBattleBodyDto } from './dto/enter-battle-body.dto';
import { ConfirmBattleEntryDto } from './dto/confirm-battle-entry.dto';

@Controller()
export class BattlesController {
  constructor(private readonly battles: BattlesService) {}

  @Public()
  @Get('battles')
  list(
    @Query('status') status?: BattleStatus,
    @Query('marketId') marketId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.battles.list({
      status,
      marketId,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('battles/:id')
  get(@Param('id') id: string, @Req() req: { user?: AuthUser }) {
    return this.battles.getById(id, req.user?.wallet);
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('markets/:marketId/battle')
  async getByMarket(
    @Param('marketId') marketId: string,
    @Req() req: { user?: AuthUser },
    @Res({ passthrough: true }) res: Response,
  ) {
    // No battle yet is normal. Nest drops `null` bodies — send explicit JSON null.
    const battle = await this.battles.getByMarketId(
      marketId,
      req.user?.wallet,
    );
    if (battle === null) {
      res.status(200).type('json').send('null');
      return;
    }
    return battle;
  }

  @Post('battles/:marketId/enter')
  enter(
    @CurrentUser() user: AuthUser,
    @Param('marketId') marketId: string,
    @Body() dto: EnterBattleBodyDto,
  ) {
    return this.battles.enter(user, { ...dto, marketId });
  }

  @Post('battles/entries/:predictionId/confirm')
  confirm(
    @CurrentUser() user: AuthUser,
    @Param('predictionId') predictionId: string,
    @Body() dto: ConfirmBattleEntryDto,
  ) {
    return this.battles.confirmEntry(user, predictionId, dto.txHash);
  }

  @Delete('battles/entries/:predictionId')
  abandon(
    @CurrentUser() user: AuthUser,
    @Param('predictionId') predictionId: string,
  ) {
    return this.battles.abandonPendingEntry(user, predictionId);
  }
}
