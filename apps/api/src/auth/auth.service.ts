import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  private async issueToken(user: { id: string; name: string; role: string }) {
    const payload = { sub: user.id, name: user.name, role: user.role };
    return {
      accessToken: await this.jwtService.signAsync(payload),
      user: payload,
    };
  }

  // Admin login: email + password
  async loginWithPassword(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.active || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');
    return this.issueToken(user);
  }

  // Staff login: userId (selected from a list on the login screen) + PIN
  async loginWithPin(userId: string, pin: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.active) throw new UnauthorizedException('Invalid credentials');
    const ok = await bcrypt.compare(pin, user.pinHash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');
    return this.issueToken(user);
  }

  async changeOwnPin(userId: string, currentPin: string, newPin: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    const ok = await bcrypt.compare(currentPin, user.pinHash);
    if (!ok) throw new UnauthorizedException('Current PIN is incorrect');
    const pinHash = await bcrypt.hash(newPin, 10);
    await this.prisma.user.update({ where: { id: userId }, data: { pinHash } });
    return { ok: true };
  }

  // Public, unauthenticated: lets the login screen show "who are you" without
  // exposing password hashes or PINs. Only id/name/role.
  async listLoginableUsers() {
    return this.prisma.user.findMany({
      where: { active: true },
      select: { id: true, name: true, role: true },
      orderBy: { name: 'asc' },
    });
  }
}
