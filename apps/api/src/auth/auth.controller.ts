import { Body, Controller, Get, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import {
  ChangePasswordDto,
  ChangePinDto,
  LoginPasswordDto,
  LoginPinDto,
  RefreshDto,
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

  // Powers the staff login tile grid — public, name/avatar only.
  @Get('staff')
  listStaff() {
    return this.authService.listLoginableStaff();
  }

  @Post('login/password')
  loginPassword(@Body() body: LoginPasswordDto, @Req() req: any) {
    return this.authService.loginWithPassword(body.email, body.password, metaFrom(req));
  }

  @Post('login/pin')
  loginPin(@Body() body: LoginPinDto, @Req() req: any) {
    return this.authService.loginWithPin(body.userId, body.pin, metaFrom(req));
  }

  @Post('refresh')
  refresh(@Body() body: RefreshDto, @Req() req: any) {
    return this.authService.refresh(body.refreshToken, metaFrom(req));
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  logout(@Req() req: any) {
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
