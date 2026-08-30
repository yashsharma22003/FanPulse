import { Controller, Get, Query } from '@nestjs/common';
import { LeaderboardService } from './leaderboard.service';
import { Public } from '../auth/public.decorator';

@Public()
@Controller('leaderboard')
export class LeaderboardController {
  constructor(private readonly leaderboard: LeaderboardService) {}

  @Get()
  list(@Query('sort') sort?: string) {
    const key = sort === 'rating' ? 'rating' : 'energy';
    return this.leaderboard.list(key);
  }
}
