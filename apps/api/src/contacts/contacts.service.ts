import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { normalizePhoneSearch } from '../common/validation/phone.validator.js';
import { nullsLast, parseSort, type SortDir } from '../common/paging.js';

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

// What a table header can sort contacts by (`field:dir`, see parseSort).
// `id` is the final tiebreaker so paging by offset never skips or repeats a row.
const SORT_FIELDS: Record<string, (dir: SortDir) => object> = {
  name: (d) => ({ name: d }),
  company: (d) => ({ company: nullsLast(d) }),
  role: (d) => ({ role: nullsLast(d) }),
  phone: (d) => ({ phone: nullsLast(d) }),
};

function orderByFor(raw?: string): any[] {
  const sort = parseSort(raw);
  const make = sort && SORT_FIELDS[sort.field];
  return [...(make && sort ? [make(sort.dir)] : []), ...(sort?.field === 'name' && make ? [] : [{ name: 'asc' }]), { id: 'asc' }];
}

@Injectable()
export class ContactsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async findAll(search?: string, status: 'active' | 'archived' | 'all' = 'active', paging: { sort?: string; limit?: number; offset?: number } = {}) {
    return (await this.findPage(search, status, paging)).rows;
  }

  // One page of contacts plus how many match in all.
  async findPage(search?: string, status: 'active' | 'archived' | 'all' = 'active', paging: { sort?: string; limit?: number; offset?: number } = {}) {
    const where = {
      ...(status === 'all' ? {} : { active: status === 'archived' ? false : true }),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { company: { contains: search, mode: 'insensitive' as const } },
              { role: { contains: search, mode: 'insensitive' as const } },
              { phone: { contains: normalizePhoneSearch(search) } },
            ],
          }
        : {}),
    };
    const [rows, counted] = await Promise.all([
      this.prisma.contact.findMany({
        where,
        orderBy: orderByFor(paging.sort),
        ...(paging.limit ? { take: paging.limit, skip: paging.offset ?? 0 } : {}),
      }),
      paging.limit ? this.prisma.contact.count({ where }) : Promise.resolve(null),
    ]);
    return { rows, total: counted ?? rows.length };
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
