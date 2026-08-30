import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Public } from './public.decorator';
import { LoginDto } from './dto/login.dto';

@Public()
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('nonce')
  nonce() {
    return this.auth.issueNonce();
  }

  @Post('login')
  login(@Body() body: LoginDto) {
    return this.auth.login(body.message, body.signature);
  }
}
