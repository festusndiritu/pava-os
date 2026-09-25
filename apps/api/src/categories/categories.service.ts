import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';

const WITH_USAGE = { _count: { select: { products: true } } } as const;

@Injectable()
export class CategoriesService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  findAll() {
    return this.prisma.category.findMany({ orderBy: { name: 'asc' }, include: WITH_USAGE });
  }

  private async get(id: string) {
    const category = await this.prisma.category.findUnique({ where: { id }, include: WITH_USAGE });
    if (!category) throw new NotFoundException('That category no longer exists.');
    return category;
  }

  // The DB unique index is case-sensitive; "Tata" and "TATA" would both fit.
  private async assertNameFree(name: string, exceptId?: string) {
    const clash = await this.prisma.category.findFirst({
      where: { name: { equals: name, mode: 'insensitive' }, ...(exceptId ? { NOT: { id: exceptId } } : {}) },
    });
    if (clash) throw new ConflictException(`A category named "${clash.name}" already exists.`);
  }

  async create(name: string, actorId: string) {
    await this.assertNameFree(name);
    const category = await this.prisma.category.create({ data: { name }, include: WITH_USAGE });
    await this.audit.log({ actorId, action: 'category.create', entityType: 'Category', entityId: category.id, metadata: { name } });
    return category;
  }

  async rename(id: string, name: string, actorId: string) {
    const existing = await this.get(id);
    if (existing.name === name) return existing;
    await this.assertNameFree(name, id);
    const category = await this.prisma.category.update({ where: { id }, data: { name }, include: WITH_USAGE });
    await this.audit.log({ actorId, action: 'category.rename', entityType: 'Category', entityId: id, metadata: { from: existing.name, to: name } });
    return category;
  }

  async remove(id: string, actorId: string) {
    const category = await this.get(id);
    const used = category._count.products;
    if (used > 0) {
      throw new ConflictException(`"${category.name}" is used by ${used} product${used === 1 ? '' : 's'}. Move ${used === 1 ? 'it' : 'them'} to another category first.`);
    }
    await this.prisma.category.delete({ where: { id } });
    await this.audit.log({ actorId, action: 'category.delete', entityType: 'Category', entityId: id, metadata: { name: category.name } });
    return { deleted: true as const };
  }
}
