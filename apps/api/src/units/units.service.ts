import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import type { CreateSubUnitDto, CreateUnitDto, UpdateSubUnitDto, UpdateUnitDto } from './dto/unit.dto.js';

const WITH_DETAIL = {
  subUnits: { orderBy: { name: 'asc' } },
  // Scoped to active products so this matches what "used" means on the
  // Products page — an archived product shouldn't keep a unit pinned.
  _count: { select: { products: { where: { active: true } } } },
} as const;

@Injectable()
export class UnitsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  findAll() {
    return this.prisma.unit.findMany({ include: WITH_DETAIL, orderBy: { name: 'asc' } });
  }

  private async get(id: string) {
    const unit = await this.prisma.unit.findUnique({ where: { id }, include: WITH_DETAIL });
    if (!unit) throw new NotFoundException('That unit no longer exists.');
    return unit;
  }

  private async assertUnitNameFree(name: string, exceptId?: string) {
    const clash = await this.prisma.unit.findFirst({
      where: { name: { equals: name, mode: 'insensitive' }, ...(exceptId ? { NOT: { id: exceptId } } : {}) },
    });
    if (clash) throw new ConflictException(`A unit named "${clash.name}" already exists.`);
  }

  async create(dto: CreateUnitDto, actorId: string) {
    await this.assertUnitNameFree(dto.name);
    const unit = await this.prisma.unit.create({ data: { name: dto.name, symbol: dto.symbol }, include: WITH_DETAIL });
    await this.audit.log({ actorId, action: 'unit.create', entityType: 'Unit', entityId: unit.id, metadata: { name: dto.name, symbol: dto.symbol } });
    return unit;
  }

  async update(id: string, dto: UpdateUnitDto, actorId: string) {
    const existing = await this.get(id);
    if (dto.name !== undefined && dto.name !== existing.name) await this.assertUnitNameFree(dto.name, id);
    const unit = await this.prisma.unit.update({
      where: { id },
      data: { ...(dto.name !== undefined ? { name: dto.name } : {}), ...(dto.symbol !== undefined ? { symbol: dto.symbol } : {}) },
      include: WITH_DETAIL,
    });
    await this.audit.log({
      actorId,
      action: 'unit.update',
      entityType: 'Unit',
      entityId: id,
      metadata: { from: { name: existing.name, symbol: existing.symbol }, to: { name: unit.name, symbol: unit.symbol } },
    });
    return unit;
  }

  async remove(id: string, actorId: string) {
    const unit = await this.get(id);
    const used = unit._count.products;
    if (used > 0) {
      throw new ConflictException(`"${unit.name}" is the unit of ${used} product${used === 1 ? '' : 's'}, so it can't be removed.`);
    }
    // Its sub-units only exist to describe it, so they go with it.
    await this.prisma.$transaction([this.prisma.subUnit.deleteMany({ where: { unitId: id } }), this.prisma.unit.delete({ where: { id } })]);
    await this.audit.log({ actorId, action: 'unit.delete', entityType: 'Unit', entityId: id, metadata: { name: unit.name, subUnits: unit.subUnits.length } });
    return { deleted: true as const };
  }

  private async assertSubUnitNameFree(unitId: string, name: string, exceptId?: string) {
    const clash = await this.prisma.subUnit.findFirst({
      where: { unitId, name: { equals: name, mode: 'insensitive' }, ...(exceptId ? { NOT: { id: exceptId } } : {}) },
    });
    if (clash) throw new ConflictException(`This unit already has a sub-unit called "${clash.name}".`);
  }

  private async getSubUnit(unitId: string, subId: string) {
    const sub = await this.prisma.subUnit.findFirst({ where: { id: subId, unitId } });
    if (!sub) throw new NotFoundException('That sub-unit no longer exists.');
    return sub;
  }

  async addSubUnit(unitId: string, dto: CreateSubUnitDto, actorId: string) {
    const unit = await this.get(unitId);
    await this.assertSubUnitNameFree(unitId, dto.name);
    const sub = await this.prisma.subUnit.create({ data: { unitId, name: dto.name, factor: dto.factor } });
    await this.audit.log({ actorId, action: 'unit.subunit_add', entityType: 'Unit', entityId: unitId, metadata: { unit: unit.name, name: dto.name, factor: dto.factor } });
    return sub;
  }

  async updateSubUnit(unitId: string, subId: string, dto: UpdateSubUnitDto, actorId: string) {
    const existing = await this.getSubUnit(unitId, subId);
    if (dto.name !== undefined && dto.name !== existing.name) await this.assertSubUnitNameFree(unitId, dto.name, subId);
    const sub = await this.prisma.subUnit.update({
      where: { id: subId },
      data: { ...(dto.name !== undefined ? { name: dto.name } : {}), ...(dto.factor !== undefined ? { factor: dto.factor } : {}) },
    });
    await this.audit.log({
      actorId,
      action: 'unit.subunit_update',
      entityType: 'Unit',
      entityId: unitId,
      metadata: { from: { name: existing.name, factor: existing.factor }, to: { name: sub.name, factor: sub.factor } },
    });
    return sub;
  }

  async removeSubUnit(unitId: string, subId: string, actorId: string) {
    const existing = await this.getSubUnit(unitId, subId);
    await this.prisma.subUnit.delete({ where: { id: subId } });
    await this.audit.log({ actorId, action: 'unit.subunit_delete', entityType: 'Unit', entityId: unitId, metadata: { name: existing.name, factor: existing.factor } });
    return { deleted: true as const };
  }
}
