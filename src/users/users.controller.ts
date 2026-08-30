import { Controller, Get, Param } from '@nestjs/common';
import { UsersService } from './users.service';
import { Public } from '../auth/public.decorator';

@Public()
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get(':wallet')
  profile(@Param('wallet') wallet: string) {
    return this.users.profile(wallet);
  }
}
