import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { Role } from '../../generated/prisma/client.js';
import { CreateStaffDto, UpdateStaffDto } from './dto/users.dto.js';

const PIN_HASH_ROUNDS = 10;

const LIST_SELECT = {
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
  updatedAt: true,
  createdBy: { select: { id: true, name: true } },
} as const;

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  findAll() {
    return this.prisma.user.findMany({ select: LIST_SELECT, orderBy: { name: 'asc' } });
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: LIST_SELECT });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async createStaff(dto: CreateStaffDto, createdById: string) {
    const pinHash = await bcrypt.hash(dto.pin, PIN_HASH_ROUNDS);
    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        role: Role.STAFF,
        avatar: dto.avatar,
        phone: dto.phone,
        pinHash,
        permissions: dto.permissions,
        createdById,
      },
      select: LIST_SELECT,
    });
    await this.audit.log({
      actorId: createdById,
      action: 'user.created',
      entityType: 'User',
      entityId: user.id,
      metadata: { name: user.name, permissions: user.permissions },
    });
    return user;
  }

  async update(id: string, dto: UpdateStaffDto, actorId: string) {
    const target = await this.prisma.user.findUnique({ where: { id } });
    if (!target) throw new NotFoundException('User not found');

    if (target.role === Role.ADMIN) {
      // Admin accounts aren't managed through the staff editor — permission
      // arrays are meaningless for them (they always have full access), and
      // letting one admin deactivate another from this screen invites
      // accidental lockouts.
      throw new ForbiddenException('Admin accounts cannot be edited here');
    }

    if (dto.active === false && id === actorId) {
      throw new BadRequestException('You cannot deactivate your own account');
    }

    const before = { permissions: target.permissions, active: target.active };

    const user = await this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.avatar !== undefined ? { avatar: dto.avatar } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(dto.permissions !== undefined ? { permissions: dto.permissions } : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
      },
      select: LIST_SELECT,
    });

    if (dto.permissions !== undefined) {
      await this.audit.log({
        actorId,
        action: 'user.permissions_changed',
        entityType: 'User',
        entityId: id,
        metadata: { before: before.permissions, after: dto.permissions },
      });
    }
    if (dto.active !== undefined && dto.active !== before.active) {
      await this.audit.log({
        actorId,
        action: dto.active ? 'user.activated' : 'user.deactivated',
        entityType: 'User',
        entityId: id,
      });
    }

    return user;
  }

  async resetPin(id: string, newPin: string, actorId: string) {
    const target = await this.prisma.user.findUnique({ where: { id } });
    if (!target) throw new NotFoundException('User not found');
    if (target.role === Role.ADMIN) {
      throw new ForbiddenException('Admin accounts cannot be edited here');
    }
    const pinHash = await bcrypt.hash(newPin, PIN_HASH_ROUNDS);
    await this.prisma.user.update({ where: { id }, data: { pinHash } });
    // Reset PIN also invalidates existing sessions for that user, since a
    // forced PIN reset usually means "lost device" / "compromised" intent.
    await this.prisma.session.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.audit.log({ actorId, action: 'user.pin_reset', entityType: 'User', entityId: id });
    return { ok: true };
  }
}
