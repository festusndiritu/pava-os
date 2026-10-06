import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { LedgerEntryType } from '../../generated/prisma/client.js';
import { normalizePhoneSearch } from '../common/validation/phone.validator.js';
import { nullsLast, parseSort, type SortDir } from '../common/paging.js';

interface CustomerInput {
  name: string;
  businessName?: string;
  phone?: string;
  altPhone?: string;
  location?: string;
  address?: string;
  notes?: string;
  isCredit?: boolean;
  creditLimit?: number;
}

// What a table header can sort customers by (`field:dir`, see parseSort).
// `id` is the final tiebreaker so paging by offset never skips or repeats a row.
const SORT_FIELDS: Record<string, (dir: SortDir) => object> = {
  name: (d) => ({ name: d }),
  phone: (d) => ({ phone: nullsLast(d) }),
  type: (d) => ({ isCredit: d }),
  balance: (d) => ({ creditBalance: d }),
};

function orderByFor(raw?: string): any[] {
  const sort = parseSort(raw);
  const make = sort && SORT_FIELDS[sort.field];
  return [...(make && sort ? [make(sort.dir)] : []), ...(sort?.field === 'name' && make ? [] : [{ name: 'asc' }]), { id: 'asc' }];
}

@Injectable()
export class CustomersService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async findAll(params: Parameters<CustomersService['findPage']>[0] = {}) {
    return (await this.findPage(params)).rows;
  }

  // One page of customers plus how many match in all.
  async findPage(params: { search?: string; status?: 'active' | 'archived' | 'all'; sort?: string; limit?: number; offset?: number } = {}) {
    const { search, status = 'active', sort, limit, offset } = params;
    const where = {
      ...(status === 'all' ? {} : { active: status === 'archived' ? false : true }),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { businessName: { contains: search, mode: 'insensitive' as const } },
              { phone: { contains: normalizePhoneSearch(search) } },
            ],
          }
        : {}),
    };
    const [rows, counted] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        orderBy: orderByFor(sort),
        ...(limit ? { take: limit, skip: offset ?? 0 } : {}),
      }),
      limit ? this.prisma.customer.count({ where }) : Promise.resolve(null),
    ]);
    return { rows, total: counted ?? rows.length };
  }

  async findOne(id: string) {
    const customer = await this.prisma.customer.findUnique({ where: { id } });
    if (!customer) throw new NotFoundException('Customer not found');
    return customer;
  }

  create(data: CustomerInput) {
    return this.prisma.customer.create({ data });
  }

  // Deliberately excludes creditBalance — that field only ever moves via a
  // ledger entry (see recordPayment/adjustBalance), never a direct PATCH,
  // so it's always explainable (brief §26).
  update(id: string, data: Partial<CustomerInput>) {
    return this.prisma.customer.update({ where: { id }, data });
  }

  // Soft delete — a customer's documents and ledger entries reference them
  // by id, so removing the row would either cascade-destroy real sales
  // history or fail the foreign key. Archiving hides them from the active
  // list without touching anything they're linked to.
  async archive(id: string, actorId: string) {
    const customer = await this.findOne(id);
    const updated = await this.prisma.customer.update({ where: { id }, data: { active: false } });
    await this.audit.log({
      actorId,
      action: 'customer.archived',
      entityType: 'Customer',
      entityId: id,
      metadata: { name: customer.businessName || customer.name, hadBalance: customer.creditBalance },
    });
    return updated;
  }

  async restore(id: string, actorId: string) {
    const updated = await this.prisma.customer.update({ where: { id }, data: { active: true } });
    await this.audit.log({ actorId, action: 'customer.restored', entityType: 'Customer', entityId: id, metadata: {} });
    return updated;
  }

  // Permanent — only once archived, and only once nothing real would be
  // lost: any document raised for this customer, any ledger entry (a
  // payment, an opening balance, a write-off), or any lead that converted
  // into it. Any of those is real business history; a customer that has
  // none of them was created by mistake and archived right away, which is
  // exactly the case this exists for.
  async hardDelete(id: string, actorId: string) {
    const customer = await this.findOne(id);
    if (customer.active) throw new BadRequestException('Archive this customer before deleting it permanently');
    const [documentCount, ledgerCount, convertedLeadCount] = await Promise.all([
      this.prisma.document.count({ where: { customerId: id } }),
      this.prisma.customerLedgerEntry.count({ where: { customerId: id } }),
      this.prisma.lead.count({ where: { convertedCustomerId: id } }),
    ]);
    if (documentCount > 0 || ledgerCount > 0 || convertedLeadCount > 0) {
      throw new BadRequestException(
        'This customer has sales, ledger, or lead history and cannot be permanently deleted',
      );
    }
    await this.prisma.customer.delete({ where: { id } });
    await this.audit.log({
      actorId,
      action: 'customer.deleted_permanently',
      entityType: 'Customer',
      entityId: id,
      metadata: { name: customer.businessName || customer.name },
    });
    return { deleted: true };
  }

  ledger(customerId: string) {
    return this.prisma.customerLedgerEntry.findMany({
      where: { customerId },
      include: { createdBy: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async recordPayment(customerId: string, amount: number, note: string | undefined, createdById: string) {
    if (amount <= 0) throw new BadRequestException('Payment amount must be positive');
    const [entry] = await this.prisma.$transaction([
      this.prisma.customerLedgerEntry.create({
        data: { customerId, type: LedgerEntryType.PAYMENT, amount: -amount, note, createdById },
      }),
      this.prisma.customer.update({ where: { id: customerId }, data: { creditBalance: { decrement: amount } } }),
    ]);
    await this.audit.log({ actorId: createdById, action: 'customer.payment_recorded', entityType: 'Customer', entityId: customerId, metadata: { amount } });
    return entry;
  }

  async adjustBalance(
    customerId: string,
    amount: number, // signed
    type: 'ADJUSTMENT' | 'OPENING' | 'REFUND' | 'WRITE_OFF',
    note: string | undefined,
    createdById: string,
  ) {
    const [entry] = await this.prisma.$transaction([
      this.prisma.customerLedgerEntry.create({
        data: { customerId, type: type as LedgerEntryType, amount, note, createdById },
      }),
      this.prisma.customer.update({ where: { id: customerId }, data: { creditBalance: { increment: amount } } }),
    ]);
    await this.audit.log({ actorId: createdById, action: 'customer.balance_adjusted', entityType: 'Customer', entityId: customerId, metadata: { type, amount, note } });
    return entry;
  }
}