import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { normalizePhoneSearch } from '../common/validation/phone.validator.js';

interface ContactInput {
  name: string;
  company?: string;
  role?: string;
  phone?: string;
  altPhone?: string;
  notes?: string;
  tags?: string[];
  followUpAt?: string;
}

@Injectable()
export class ContactsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  findAll(search?: string, status: 'active' | 'archived' | 'all' = 'active', paging: { limit?: number; offset?: number } = {}) {
    return this.prisma.contact.findMany({
      where: {
        ...(status === 'all' ? {} : { active: status === 'archived' ? false : true }),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { company: { contains: search, mode: 'insensitive' } },
                { role: { contains: search, mode: 'insensitive' } },
                { phone: { contains: normalizePhoneSearch(search) } },
              ],
            }
          : {}),
      },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      ...(paging.limit ? { take: paging.limit, skip: paging.offset ?? 0 } : {}),
    });
  }

  async findOne(id: string) {
    const contact = await this.prisma.contact.findUnique({ where: { id } });
    if (!contact) throw new NotFoundException('Contact not found');
    return contact;
  }

  create(createdById: string, data: ContactInput) {
    const { followUpAt, ...rest } = data;
    return this.prisma.contact.create({
      data: { ...rest, followUpAt: followUpAt ? new Date(followUpAt) : undefined, createdById },
    });
  }

  update(id: string, data: Partial<ContactInput>) {
    const { followUpAt, ...rest } = data;
    return this.prisma.contact.update({
      where: { id },
      data: { ...rest, ...(followUpAt ? { followUpAt: new Date(followUpAt) } : {}) },
    });
  }

  // Soft delete — same convention as Customer/Product/Lead.
  async archive(id: string, actorId: string) {
    const contact = await this.findOne(id);
    const updated = await this.prisma.contact.update({ where: { id }, data: { active: false } });
    await this.audit.log({ actorId, action: 'contact.archived', entityType: 'Contact', entityId: id, metadata: { name: contact.name } });
    return updated;
  }

  async restore(id: string, actorId: string) {
    const updated = await this.prisma.contact.update({ where: { id }, data: { active: true } });
    await this.audit.log({ actorId, action: 'contact.restored', entityType: 'Contact', entityId: id, metadata: {} });
    return updated;
  }

  // Permanent — a Contact is a phone-book entry with nothing keyed off it
  // (no document, ledger or FK anywhere references one), so once archived
  // there's no dependent data to check before removing it for good.
  async hardDelete(id: string, actorId: string) {
    const contact = await this.findOne(id);
    if (contact.active) throw new BadRequestException('Archive this contact before deleting it permanently');
    await this.prisma.contact.delete({ where: { id } });
    await this.audit.log({ actorId, action: 'contact.deleted_permanently', entityType: 'Contact', entityId: id, metadata: { name: contact.name } });
    return { deleted: true };
  }
}
