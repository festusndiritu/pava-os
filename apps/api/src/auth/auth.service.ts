import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { randomBytes, createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { Role } from '../../generated/prisma/client.js';

interface AuthedUser {
  id: string;
  name: string;
  role: Role;
  permissions: string[];
}

export interface RequestMeta {
  userAgent?: string;
  ip?: string;
}

const PIN_HASH_ROUNDS = 10;
const PASSWORD_HASH_ROUNDS = 12;

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private config: ConfigService,
    private audit: AuditService,
  ) {}

  private inactivityMinutesFor(role: Role) {
    const key = role === Role.ADMIN ? 'ADMIN_INACTIVITY_MINUTES' : 'STAFF_INACTIVITY_MINUTES';
    return Number(this.config.get(key)) || (role === Role.ADMIN ? 30 : 60);
  }

  private sessionMaxHours() {
    return Number(this.config.get('SESSION_MAX_HOURS')) || 12;
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private async issueAccessToken(user: AuthedUser, sessionId: string) {
    const payload = {
      sub: user.id,
      name: user.name,
      role: user.role,
      permissions: user.permissions,
      sid: sessionId,
    };
    return this.jwtService.signAsync(payload, {
      expiresIn: this.config.get('JWT_ACCESS_TOKEN_TTL') || '15m',
    });
  }

  private async createSession(userId: string, meta?: RequestMeta) {
    const refreshToken = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + this.sessionMaxHours() * 60 * 60 * 1000);
    const session = await this.prisma.session.create({
      data: {
        userId,
        refreshTokenHash: this.hashToken(refreshToken),
        userAgent: meta?.userAgent,
        ip: meta?.ip,
        expiresAt,
      },
    });
    return { session, refreshToken };
  }

  private async issuePair(user: AuthedUser, meta?: RequestMeta) {
    const { session, refreshToken } = await this.createSession(user.id, meta);
    const accessToken = await this.issueAccessToken(user, session.id);
    return {
      accessToken,
      refreshToken,
      expiresInMinutes: this.inactivityMinutesFor(user.role),
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        permissions: user.permissions,
      },
    };
  }

  private toAuthedUser(u: {
    id: string;
    name: string;
    role: Role;
    permissions: string[];
  }): AuthedUser {
    return { id: u.id, name: u.name, role: u.role, permissions: u.permissions };
  }

  // Admin login: email + password
  async loginWithPassword(email: string, password: string, meta?: RequestMeta) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.active || !user.passwordHash || user.role !== Role.ADMIN) {
      await this.audit.log({ action: 'auth.login_failed', metadata: { email, method: 'password' } });
      throw new UnauthorizedException('Invalid credentials');
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      await this.audit.log({
        actorId: user.id,
        action: 'auth.login_failed',
        metadata: { method: 'password' },
      });
      throw new UnauthorizedException('Invalid credentials');
    }
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await this.audit.log({ actorId: user.id, action: 'auth.login', metadata: { method: 'password' } });
    return this.issuePair(this.toAuthedUser(user), meta);
  }

  // Staff login: userId (selected from a list on the login screen) + PIN.
  // Deliberately returns the same generic error for "no such user", "inactive",
  // and "wrong PIN" so the API never confirms which case applies.
  async loginWithPin(userId: string, pin: string, meta?: RequestMeta) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.active || !user.pinHash) {
      throw new UnauthorizedException('Incorrect PIN');
    }
    const ok = await bcrypt.compare(pin, user.pinHash);
    if (!ok) {
      await this.audit.log({
        actorId: user.id,
        action: 'auth.login_failed',
        metadata: { method: 'pin' },
      });
      throw new UnauthorizedException('Incorrect PIN');
    }
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await this.audit.log({ actorId: user.id, action: 'auth.login', metadata: { method: 'pin' } });
    return this.issuePair(this.toAuthedUser(user), meta);
  }

  // Sliding-inactivity refresh. Rejects if the session was revoked, has hit
  // its absolute cap, or has been idle longer than the user's role allows —
  // in all three cases the session is also revoked so it can't be replayed.
  async refresh(refreshToken: string, meta?: RequestMeta) {
    const tokenHash = this.hashToken(refreshToken);
    const session = await this.prisma.session.findUnique({
      where: { refreshTokenHash: tokenHash },
      include: { user: true },
    });
    if (!session || session.revokedAt) throw new UnauthorizedException('Session expired');

    const now = Date.now();
    const idleMs = now - session.lastActiveAt.getTime();
    const idleLimitMs = this.inactivityMinutesFor(session.user.role) * 60 * 1000;
    const expired = now > session.expiresAt.getTime() || idleMs > idleLimitMs;

    if (expired || !session.user.active) {
      await this.prisma.session.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
      throw new UnauthorizedException('Session expired');
    }

    // Rotate the refresh token on every use (limits replay window if leaked).
    const newRefreshToken = randomBytes(32).toString('hex');
    await this.prisma.session.update({
      where: { id: session.id },
      data: {
        refreshTokenHash: this.hashToken(newRefreshToken),
        lastActiveAt: new Date(),
        userAgent: meta?.userAgent ?? session.userAgent,
        ip: meta?.ip ?? session.ip,
      },
    });

    const accessToken = await this.issueAccessToken(this.toAuthedUser(session.user), session.id);
    return {
      accessToken,
      refreshToken: newRefreshToken,
      expiresInMinutes: this.inactivityMinutesFor(session.user.role),
      user: {
        id: session.user.id,
        name: session.user.name,
        role: session.user.role,
        permissions: session.user.permissions,
      },
    };
  }

  async logout(sessionId: string, actorId: string) {
    await this.prisma.session
      .updateMany({ where: { id: sessionId, userId: actorId }, data: { revokedAt: new Date() } })
      .catch(() => undefined);
    await this.audit.log({ actorId, action: 'auth.logout' });
    return { ok: true };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        role: true,
        email: true,
        avatar: true,
        phone: true,
        permissions: true,
        active: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });
    if (!user || !user.active) throw new UnauthorizedException();
    return user;
  }

  async changeOwnPin(userId: string, currentPin: string, newPin: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.pinHash) throw new UnauthorizedException();
    const ok = await bcrypt.compare(currentPin, user.pinHash);
    if (!ok) throw new BadRequestException('Current PIN is incorrect');
    if (newPin === currentPin) throw new BadRequestException('New PIN must be different');
    const pinHash = await bcrypt.hash(newPin, PIN_HASH_ROUNDS);
    await this.prisma.user.update({ where: { id: userId }, data: { pinHash } });
    await this.audit.log({ actorId: userId, action: 'auth.pin_changed' });
    return { ok: true };
  }

  async changeOwnPassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.passwordHash) throw new UnauthorizedException();
    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) throw new BadRequestException('Current password is incorrect');
    const passwordHash = await bcrypt.hash(newPassword, PASSWORD_HASH_ROUNDS);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    await this.audit.log({ actorId: userId, action: 'auth.password_changed' });
    return { ok: true };
  }

  // A user may rename/re-avatar themselves but never touch their own
  // permissions or role — those routes live in UsersService (admin-only).
  async updateOwnProfile(userId: string, data: { name?: string; avatar?: string }) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.avatar !== undefined ? { avatar: data.avatar } : {}),
      },
      select: { id: true, name: true, avatar: true, role: true, permissions: true },
    });
    await this.audit.log({ actorId: userId, action: 'auth.profile_updated' });
    return user;
  }

  // Public, unauthenticated: powers the staff login tile grid. Only ever
  // returns id/name/avatar for active STAFF accounts — never hashes, never
  // ADMIN accounts (admins sign in via the separate password form).
  async listLoginableStaff() {
    return this.prisma.user.findMany({
      where: { active: true, role: Role.STAFF },
      select: { id: true, name: true, avatar: true },
      orderBy: { name: 'asc' },
    });
  }
}
