import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ACCESS_COOKIE, readCookie } from './session-cookies.js';

// Manual JWT guard (no passport dependency) — reads the httpOnly session cookie (or Authorization: Bearer
// for non-browser clients), verifies it, and attaches the decoded payload as request.user.
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader: string | undefined = request.headers['authorization'];
    const token = readCookie(request, ACCESS_COOKIE) ?? (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined);
    if (!token) throw new UnauthorizedException('Missing token');
    try {
      const payload = await this.jwtService.verifyAsync(token);
      request.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
