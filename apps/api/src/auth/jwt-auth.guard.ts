import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

// Manual JWT guard (no passport dependency) — reads Authorization: Bearer <token>,
// verifies it, and attaches the decoded payload as request.user.
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader: string | undefined = request.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing token');
    }
    const token = authHeader.slice('Bearer '.length);
    try {
      const payload = await this.jwtService.verifyAsync(token);
      request.user = payload; // { sub, name, role }
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
