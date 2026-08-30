import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ChallengesService } from './challenges.service';
import { Public } from '../auth/public.decorator';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator';
import { ConfirmFillDto } from '../predictions/dto/confirm-fill.dto';

@Controller('challenges')
export class ChallengesController {
  constructor(private readonly challenges: ChallengesService) {}

  @Public()
  @Get(':id')
  get(@Param('id') id: string) {
    return this.challenges.get(id);
  }

  @Post(':id/confirm')
  confirm(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ConfirmFillDto,
  ) {
    return this.challenges.confirmByOriginal(user, id, dto.txHash);
  }
}
