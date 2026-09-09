import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { LedgerEntryType } from '../../generated/prisma/client.js';

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

@Injectable()
export class CustomersService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  findAll(search?: string) {
    return this.prisma.customer.findMany({
      where: search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { businessName: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search } },
            ],
          }
        : undefined,
      orderBy: { name: 'asc' },
    });
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