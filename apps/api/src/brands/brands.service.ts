import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';

const WITH_USAGE = { _count: { select: { products: true } } } as const;

@Injectable()
export class BrandsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  findAll() {
    return this.prisma.brand.findMany({ orderBy: { name: 'asc' }, include: WITH_USAGE });
  }

  private async get(id: string) {
    const brand = await this.prisma.brand.findUnique({ where: { id }, include: WITH_USAGE });
    if (!brand) throw new NotFoundException('That brand no longer exists.');
    return brand;
  }

  // The DB unique index is case-sensitive; "Tata" and "TATA" would both fit.
  private async assertNameFree(name: string, exceptId?: string) {
    const clash = await this.prisma.brand.findFirst({
      where: { name: { equals: name, mode: 'insensitive' }, ...(exceptId ? { NOT: { id: exceptId } } : {}) },
    });
    if (clash) throw new ConflictException(`A brand named "${clash.name}" already exists.`);
  }

  async create(name: string, actorId: string) {
    await this.assertNameFree(name);
    const brand = await this.prisma.brand.create({ data: { name }, include: WITH_USAGE });
    await this.audit.log({ actorId, action: 'brand.create', entityType: 'Brand', entityId: brand.id, metadata: { name } });
    return brand;
  }

  async rename(id: string, name: string, actorId: string) {
    const existing = await this.get(id);
    if (existing.name === name) return existing;
    await this.assertNameFree(name, id);
    const brand = await this.prisma.brand.update({ where: { id }, data: { name }, include: WITH_USAGE });
    await this.audit.log({ actorId, action: 'brand.rename', entityType: 'Brand', entityId: id, metadata: { from: existing.name, to: name } });
    return brand;
  }

  async remove(id: string, actorId: string) {
    const brand = await this.get(id);
    const used = brand._count.products;
    if (used > 0) {
      throw new ConflictException(`"${brand.name}" is used by ${used} product${used === 1 ? '' : 's'}. Move ${used === 1 ? 'it' : 'them'} to another brand first.`);
    }
    await this.prisma.brand.delete({ where: { id } });
    await this.audit.log({ actorId, action: 'brand.delete', entityType: 'Brand', entityId: id, metadata: { name: brand.name } });
    return { deleted: true as const };
  }
}
