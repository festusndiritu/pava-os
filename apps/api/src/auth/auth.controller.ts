import { Body, Controller, Post, Get, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Get('users')
  listUsers() {
    // Used by the login screen to render "who's logging in" for PIN auth.
    return this.authService.listLoginableUsers();
  }

  @Post('login/password')
  loginPassword(@Body() body: { email: string; password: string }) {
    return this.authService.loginWithPassword(body.email, body.password);
  }

  @Post('login/pin')
  loginPin(@Body() body: { userId: string; pin: string }) {
    return this.authService.loginWithPin(body.userId, body.pin);
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-pin')
  changePin(@Req() req: any, @Body() body: { currentPin: string; newPin: string }) {
    return this.authService.changeOwnPin(req.user.sub, body.currentPin, body.newPin);
  }
}
