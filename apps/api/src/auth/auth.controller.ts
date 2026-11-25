import { Body, Controller, Get, Patch, Post, Req, Res, UnauthorizedException, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { clearSessionCookies, readCookie, REFRESH_COOKIE, setSessionCookies } from './session-cookies.js';
import {
  ChangePasswordDto,
  ChangePinDto,
  LoginPasswordDto,
  LoginPinDto,
  UpdateProfileDto,
} from './dto/auth.dto.js';

function metaFrom(req: any) {
  return {
    userAgent: req.headers['user-agent'],
    ip: req.ip,
  };
}

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  // Moves the tokens out of the response body into httpOnly cookies.
  private withCookies(res: Response, { accessToken, refreshToken, ...session }: { accessToken: string; refreshToken: string }) {
    setSessionCookies(res, accessToken, refreshToken, this.authService.sessionMaxHours());
    return session;
  }

  // Powers the staff login tile grid — public, name/avatar only.
  @Get('staff')
  listStaff() {
    return this.authService.listLoginableStaff();
  }

  @Post('login/password')
  async loginPassword(@Body() body: LoginPasswordDto, @Req() req: any, @Res({ passthrough: true }) res: Response) {
    return this.withCookies(res, await this.authService.loginWithPassword(body.email, body.password, metaFrom(req)));
  }

  @Post('login/pin')
  async loginPin(@Body() body: LoginPinDto, @Req() req: any, @Res({ passthrough: true }) res: Response) {
    return this.withCookies(res, await this.authService.loginWithPin(body.userId, body.pin, metaFrom(req)));
  }

  @Post('refresh')
  async refresh(@Req() req: any, @Res({ passthrough: true }) res: Response) {
    const refreshToken = readCookie(req, REFRESH_COOKIE);
    if (!refreshToken) throw new UnauthorizedException('Session expired');
    return this.withCookies(res, await this.authService.refresh(refreshToken, metaFrom(req)));
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  logout(@Req() req: any, @Res({ passthrough: true }) res: Response) {
    clearSessionCookies(res);
    return this.authService.logout(req.user.sid, req.user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Req() req: any) {
    return this.authService.me(req.user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('profile')
  updateProfile(@Req() req: any, @Body() body: UpdateProfileDto) {
    return this.authService.updateOwnProfile(req.user.sub, body);
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-pin')
  changePin(@Req() req: any, @Body() body: ChangePinDto) {
    return this.authService.changeOwnPin(req.user.sub, body.currentPin, body.newPin);
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  changePassword(@Req() req: any, @Body() body: ChangePasswordDto) {
    return this.authService.changeOwnPassword(req.user.sub, body.currentPassword, body.newPassword);
  }
}
