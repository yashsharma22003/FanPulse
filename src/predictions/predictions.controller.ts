import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { PredictionsService } from './predictions.service';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator';
import { Public } from '../auth/public.decorator';
import { CreatePredictionDto } from './dto/create-prediction.dto';
import { ChallengePredictionDto } from './dto/challenge-prediction.dto';
import { ConfirmFillDto } from './dto/confirm-fill.dto';

@Controller('predictions')
export class PredictionsController {
  constructor(private readonly predictions: PredictionsService) {}

  @Public()
  @Get('open')
  listOpen() {
    return this.predictions.listOpen();
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreatePredictionDto) {
    return this.predictions.create(user, dto);
  }

  @Post(':id/confirm')
  confirm(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ConfirmFillDto,
  ) {
    return this.predictions.confirm(user, id, dto.txHash);
  }

  @Post(':id/challenge')
  challenge(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ChallengePredictionDto,
  ) {
    return this.predictions.challenge(user, id, dto);
  }
}
